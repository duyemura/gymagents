/**
 * follow-up-evaluator.ts — AI-driven follow-up decisions.
 *
 * When a task is past its next_action_at and the member hasn't replied,
 * the cron calls this evaluator instead of running hardcoded cadence logic.
 *
 * The AI reads the skill file's multi-touch guidelines, the conversation
 * history, business memories, and member context — then decides:
 *   1. Should we follow up, close, escalate, or wait?
 *   2. If follow up: what message? When to check again?
 *   3. If close: what outcome and why?
 *
 * The cron is pure infrastructure — it just executes the AI's decision.
 */

import Anthropic from '@anthropic-ai/sdk'
import { HAIKU } from './models'
import { buildEvaluationPrompt } from './skill-loader'
import type { TaskOutcome } from './types/agents'

// ── Types ────────────────────────────────────────────────────────────────────

export interface FollowUpContext {
  /** Task type (maps to skill file for approach guidelines) */
  taskType: string
  /** Account ID for memory injection */
  accountId: string
  /** Member's name */
  memberName: string
  /** Member's email */
  memberEmail: string
  /** Previous messages in the conversation (agent + member) */
  conversationHistory: { role: 'agent' | 'member'; content: string }[]
  /** How many outbound messages the agent has already sent */
  messagesSent: number
  /** Days since the last outbound message was sent */
  daysSinceLastMessage: number
  /** Account/business name */
  accountName?: string
  /** Member-specific context from the original task */
  memberContext?: string
}

export interface FollowUpDecision {
  /** What should we do? */
  action: 'follow_up' | 'close' | 'escalate' | 'wait'
  /** The follow-up message (when action = follow_up) */
  message?: string
  /** Task outcome (when action = close) */
  outcome?: TaskOutcome
  /** Why we're taking this action */
  reason: string
  /** Days until next check (when action = follow_up or wait) */
  nextCheckDays?: number
}

// Lazy singleton — avoids module-level init crashing Next.js build
let _anthropic: Anthropic | null = null
function getClient(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  return _anthropic
}

// ── Core ─────────────────────────────────────────────────────────────────────

/**
 * Evaluate whether a follow-up is warranted and what to do next.
 *
 * Single AI call that returns both the decision and the message.
 * Uses Haiku for cost efficiency (~$0.001 per evaluation).
 * Falls back to a safe "close as unresponsive" if the AI call fails.
 */
export async function evaluateFollowUp(ctx: FollowUpContext): Promise<FollowUpDecision> {
  try {
    // Load skill prompt with memories — same prompt RetentionAgent uses for evaluation
    const systemPrompt = await buildEvaluationPrompt(ctx.taskType, {
      accountId: ctx.accountId,
      memberId: ctx.memberEmail,
    })

    const conversationBlock = ctx.conversationHistory.length > 0
      ? ctx.conversationHistory
          .map(m => `[${m.role === 'agent' ? 'BUSINESS' : 'MEMBER'}]: ${m.content}`)
          .join('\n\n')
      : '(No messages sent yet)'

    const userPrompt = `${ctx.accountName ? `Business: ${ctx.accountName}\n` : ''}Member: ${ctx.memberName} (${ctx.memberEmail})
${ctx.memberContext ? `Context: ${ctx.memberContext}\n` : ''}
Messages sent so far: ${ctx.messagesSent}
Days since last outbound message: ${ctx.daysSinceLastMessage}

Conversation:
${conversationBlock}

The member has not replied to the last message. Using the skill guidelines above (especially the multi-touch approach), decide:
1. Should we send another follow-up, close the task, escalate to the owner, or wait longer?
2. If following up: write the next message following the appropriate Touch guidelines. Do NOT repeat what was already said.
3. If closing: explain why (unresponsive after reasonable attempts, etc.)
4. If following up or waiting: how many days until we should check again?

Respond ONLY with valid JSON (no markdown fences):
{
  "reasoning": "2-3 sentences explaining your decision based on the conversation and skill guidelines",
  "action": "follow_up" | "close" | "escalate" | "wait",
  "message": "the follow-up message text (required if action=follow_up, omit otherwise)",
  "outcome": "unresponsive" | "churned" | "engaged" | "escalated" | "not_applicable" (required if action=close or escalate, omit otherwise),
  "nextCheckDays": number (required if action=follow_up or wait — how many days until next check)
}`

    const response = await getClient().messages.create({
      model: HAIKU,
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const block = response.content.find(b => b.type === 'text')
    const text = block?.type === 'text' ? block.text.trim() : ''

    return parseDecision(text)
  } catch (err) {
    console.warn('[follow-up-evaluator] AI evaluation failed, using safe fallback:', (err as Error).message)
    return safeFallback(ctx)
  }
}

// ── Parsing ──────────────────────────────────────────────────────────────────

function parseDecision(raw: string): FollowUpDecision {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in response')

  const parsed = JSON.parse(jsonMatch[0])

  const action = (['follow_up', 'close', 'escalate', 'wait'] as const).includes(parsed.action)
    ? parsed.action as FollowUpDecision['action']
    : 'close'

  const decision: FollowUpDecision = {
    action,
    reason: parsed.reasoning ?? parsed.reason ?? 'AI evaluation',
  }

  if (action === 'follow_up') {
    decision.message = typeof parsed.message === 'string' ? parsed.message.trim() : undefined
    decision.nextCheckDays = typeof parsed.nextCheckDays === 'number' ? parsed.nextCheckDays : 7
    // If AI said follow_up but gave no message, fall back to close
    if (!decision.message) {
      decision.action = 'close'
      decision.outcome = 'unresponsive'
      decision.reason = 'AI recommended follow-up but provided no message'
    }
  }

  if (action === 'close' || (decision.action === 'close')) {
    decision.outcome = parseOutcome(parsed.outcome) ?? 'unresponsive'
  }

  if (action === 'escalate') {
    decision.outcome = 'escalated'
  }

  if (action === 'wait') {
    decision.nextCheckDays = typeof parsed.nextCheckDays === 'number' ? parsed.nextCheckDays : 3
  }

  return decision
}

function parseOutcome(raw: unknown): TaskOutcome | undefined {
  const valid: TaskOutcome[] = ['converted', 'recovered', 'engaged', 'unresponsive', 'churned', 'escalated', 'not_applicable']
  return typeof raw === 'string' && valid.includes(raw as TaskOutcome)
    ? raw as TaskOutcome
    : undefined
}

/**
 * Safe fallback when AI evaluation fails entirely.
 * Conservative: if we've sent 3+ messages with no reply, close as unresponsive.
 * Otherwise, wait and try again later.
 */
function safeFallback(ctx: FollowUpContext): FollowUpDecision {
  if (ctx.messagesSent >= 3) {
    return {
      action: 'close',
      outcome: 'unresponsive',
      reason: 'AI evaluation unavailable — closing after multiple unanswered messages',
    }
  }

  return {
    action: 'wait',
    reason: 'AI evaluation unavailable — will retry later',
    nextCheckDays: 3,
  }
}
