export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/run-analysis
 *
 * Vercel Cron endpoint — runs GMAgent analysis for all connected accounts.
 * Called every 6 hours by Vercel Cron.
 * Validates CRON_SECRET header before processing.
 *
 * For each account:
 *   1. Build AccountSnapshot via connector (pushpress-platform.ts)
 *   2. Run GMAgent.runAnalysis() (AI-driven)
 *   3. Save KPI snapshot + artifact
 *
 * This route is infrastructure — it fetches credentials, calls the connector
 * to build an abstract AccountSnapshot, and delegates analysis to the AI.
 * No PushPress-specific types or logic live here.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { decrypt } from '@/lib/encrypt'
import { GMAgent } from '@/lib/agents/GMAgent'
import type { AccountSnapshot } from '@/lib/agents/GMAgent'
import { createInsightTask } from '@/lib/db/tasks'
import { saveKPISnapshot, getMonthlyRetentionROI } from '@/lib/db/kpi'
import { appendSystemEvent } from '@/lib/db/chat'
import { createArtifact } from '@/lib/artifacts/db'
import type { ResearchSummaryData } from '@/lib/artifacts/types'
import * as dbTasks from '@/lib/db/tasks'
import { sendEmail } from '@/lib/resend'
import Anthropic from '@anthropic-ai/sdk'
import { HAIKU } from '@/lib/models'
import { buildAccountSnapshot } from '@/lib/pushpress-platform'

// ──────────────────────────────────────────────────────────────────────────────
// Simple Claude evaluate helper for cron context
// ──────────────────────────────────────────────────────────────────────────────

async function claudeEvaluate(system: string, prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const response = await client.messages.create({
    model: HAIKU,
    max_tokens: 512,
    system,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = response.content.find(b => b.type === 'text')
  return block?.type === 'text' ? block.text : ''
}

// ──────────────────────────────────────────────────────────────────────────────
// Build AgentDeps for GMAgent
// ──────────────────────────────────────────────────────────────────────────────

function buildAgentDeps() {
  return {
    db: {
      getTask: dbTasks.getTask,
      updateTaskStatus: dbTasks.updateTaskStatus,
      appendConversation: dbTasks.appendConversation,
      getConversationHistory: dbTasks.getConversationHistory,
      createOutboundMessage: async () => { throw new Error('not used in analysis') },
      updateOutboundMessageStatus: async () => { throw new Error('not used in analysis') },
    },
    events: {
      publishEvent: async () => 'noop',
    },
    mailer: {
      sendEmail: async (params: any) => {
        await sendEmail(params)
        return { id: 'noop' }
      },
    },
    claude: {
      evaluate: claudeEvaluate,
    },
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/cron/run-analysis
// ──────────────────────────────────────────────────────────────────────────────

async function handler(req: NextRequest): Promise<NextResponse> {
  // Validate CRON_SECRET — Vercel sends Authorization: Bearer <CRON_SECRET> on GET
  const authHeader = req.headers.get('authorization')
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[run-analysis] Starting analysis cron')

  // Fetch all connected accounts
  const { data: accounts, error: accountsError } = await supabaseAdmin
    .from('accounts')
    .select('id, gym_name, pushpress_api_key, pushpress_company_id, avg_membership_price')
    .not('pushpress_api_key', 'is', null)

  if (accountsError) {
    console.error('[run-analysis] Failed to fetch accounts:', accountsError.message)
    return NextResponse.json({ error: accountsError.message }, { status: 500 })
  }

  let accountsAnalyzed = 0
  let totalInsights = 0
  let totalTasksCreated = 0

  for (const account of accounts ?? []) {
    try {
      // Decrypt API key
      let apiKey: string
      try {
        apiKey = decrypt(account.pushpress_api_key)
      } catch (err) {
        console.error(`[run-analysis] Could not decrypt API key for account ${account.id}:`, err)
        continue
      }

      // Build snapshot via connector layer — all PushPress-specific logic lives there
      let snapshot: AccountSnapshot
      try {
        snapshot = await buildAccountSnapshot(
          account.id,
          account.gym_name ?? 'Business',
          apiKey,
          account.pushpress_company_id ?? undefined,
          account.avg_membership_price ?? undefined,
        )
      } catch (err) {
        console.error(`[run-analysis] Connector fetch failed for account ${account.id}:`, err)
        continue
      }

      // Run GMAgent analysis
      const deps = buildAgentDeps()
      const agent = new GMAgent(deps as any)
      agent.setCreateInsightTask((params) => createInsightTask(params))

      const result = await agent.runAnalysis(account.id, snapshot)

      // Save KPI snapshot
      const activeMembers = snapshot.members.filter(m => m.status === 'active').length
      // Count at-risk members by priority (not hardcoded type) — works with AI-assigned types
      const churnRiskCount = result.insights.filter(
        i => i.priority === 'critical' || i.priority === 'high'
      ).length
      const revenueMtd = snapshot.members
        .filter(m => m.status === 'active')
        .reduce((sum, m) => sum + m.monthlyRevenue, 0)

      await saveKPISnapshot(account.id, {
        activeMembers,
        churnRiskCount,
        revenueMtd,
        insightsGenerated: result.insightsFound,
        rawData: {
          snapshotCapturedAt: snapshot.capturedAt,
          totalMembers: snapshot.members.length,
        },
      })

      // Append system event to the unified GM chat log
      await appendSystemEvent(
        account.id,
        `GM ran analysis. Found ${result.insightsFound} insight${result.insightsFound !== 1 ? 's' : ''}${result.insightsFound > 0 ? ', added to your To-Do.' : '.'}`,
      )

      // Generate research summary artifact (fire-and-forget)
      if (result.insights.length > 0) {
        generateAnalysisArtifact(
          account.id,
          account.gym_name ?? 'Your Business',
          result,
          snapshot,
        ).catch(err => {
          console.warn(`[run-analysis] Artifact generation failed for account ${account.id}:`, (err as Error).message)
        })
      }

      accountsAnalyzed++
      totalInsights += result.insightsFound
      totalTasksCreated += result.tasksCreated

      console.log(
        `[run-analysis] account=${account.id} insights=${result.insightsFound} tasks=${result.tasksCreated}`
      )
    } catch (err) {
      console.error(`[run-analysis] Unexpected error for account ${account.id}:`, err)
      // Continue to next account — never abort the whole run
    }
  }

  console.log(
    `[run-analysis] Done. accountsAnalyzed=${accountsAnalyzed} insights=${totalInsights} tasks=${totalTasksCreated}`
  )

  return NextResponse.json({
    ok: true,
    accountsAnalyzed,
    totalInsights,
    totalTasksCreated,
  })
}

// ── Artifact generation ──────────────────────────────────────────────────────

async function generateAnalysisArtifact(
  accountId: string,
  accountName: string,
  result: { insights: any[]; insightsFound: number; tasksCreated: number },
  snapshot: AccountSnapshot,
) {
  const now = new Date()
  const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  // Get monthly ROI for the artifact
  let roi = { membersRetained: 0, revenueRetained: 0, messagesSent: 0, conversationsActive: 0, escalations: 0 }
  try {
    roi = await getMonthlyRetentionROI(accountId)
  } catch {
    // Non-fatal
  }

  const priorityToRisk = (p: string): 'high' | 'medium' | 'low' =>
    p === 'critical' || p === 'high' ? 'high' : p === 'medium' ? 'medium' : 'low'

  // Derive member status from priority — not from type string keywords.
  // The AI assigns types freely; priority is the reliable, structured signal.
  const priorityToStatus = (p: string): 'at_risk' | 'escalated' | 'active' =>
    p === 'critical' ? 'escalated' : p === 'high' || p === 'medium' ? 'at_risk' : 'active'

  const artifactData: ResearchSummaryData = {
    accountName,
    generatedAt: now.toISOString(),
    period: monthLabel,
    generatedBy: 'GM Agent',
    stats: {
      membersAtRisk: result.insights.filter(i => i.priority === 'critical' || i.priority === 'high' || i.priority === 'medium').length,
      membersRetained: roi.membersRetained,
      revenueRetained: roi.revenueRetained,
      messagesSent: roi.messagesSent,
      conversationsActive: roi.conversationsActive,
      escalations: roi.escalations,
    },
    members: result.insights.slice(0, 15).map(insight => ({
      name: insight.memberName ?? 'Unknown',
      email: insight.memberEmail,
      status: priorityToStatus(insight.priority),
      riskLevel: priorityToRisk(insight.priority),
      detail: insight.detail ?? insight.title,
      membershipValue: undefined,
    })),
    insights: [
      ...result.insights.length > 0
        ? [`${result.insightsFound} members flagged across ${new Set(result.insights.map((i: any) => i.type)).size} categories`]
        : [],
      ...(result.insights.filter((i: any) => i.priority === 'critical').length > 0
        ? [`${result.insights.filter((i: any) => i.priority === 'critical').length} critical priority — review these first`]
        : []),
      ...(roi.membersRetained > 0
        ? [`${roi.membersRetained} members retained this month, saving $${roi.revenueRetained.toLocaleString()}`]
        : []),
    ],
  }

  await createArtifact({
    accountId,
    artifactType: 'research_summary',
    title: `${accountName} — Analysis Summary`,
    data: artifactData as unknown as Record<string, unknown>,
    createdBy: 'gm',
    shareable: true,
  })

  console.log(`[run-analysis] Artifact generated for account ${accountId}`)
}

// Vercel Cron Jobs send GET requests — also keep POST for manual triggers
export const GET = handler
export const POST = handler
