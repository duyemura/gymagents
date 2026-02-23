/**
 * POST /api/gm/chat
 *
 * GM Agent chat endpoint — reactive mode.
 * Classifies the owner's message, routes to the appropriate handler,
 * logs the exchange, and returns a structured response.
 *
 * Routes:
 *   direct_answer     — pure reasoning, no PushPress call needed
 *   inline_query      — single PushPress data fetch + format
 *   prebuilt_specialist — known domain (churn, revenue, funnel) with specialist prompt
 *   dynamic_specialist  — novel task: GM writes specialist prompt first, then runs it
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  classifyTask,
  claudeRespond,
  buildGymSystemPrompt,
  pickSpecialist,
  SPECIALIST_PROMPTS,
  type TaskRoute,
  type ActionType,
  type GMChatResponse,
  type GymContext,
} from '@/lib/gmChat'
import { appendChatMessage } from '@/lib/db/chat'

// ── Helpers ───────────────────────────────────────────────────────────────────

interface GymRow {
  gym_name: string
  member_count: number
  pushpress_api_key: string | null
  pushpress_company_id: string | null
}

async function loadGymContext(gymId: string): Promise<GymContext & { apiKey?: string; companyId?: string }> {
  try {
    const { data } = await supabaseAdmin
      .from('gyms')
      .select('gym_name, member_count, pushpress_api_key, pushpress_company_id')
      .eq('id', gymId)
      .single()

    const row = data as GymRow | null
    return {
      gymId,
      gymName: row?.gym_name ?? 'Your Gym',
      memberCount: row?.member_count ?? 0,
      apiKey: row?.pushpress_api_key ?? undefined,
      companyId: row?.pushpress_company_id ?? undefined,
    }
  } catch {
    return { gymId, gymName: 'Your Gym', memberCount: 0 }
  }
}

function inferActionType(reply: string, route: TaskRoute): ActionType {
  if (route === 'dynamic_specialist') return 'recommendation'
  if (route === 'prebuilt_specialist') return 'recommendation'
  if (/\btable\b|\blist\b|\bhere are\b|\bfollowing\b/i.test(reply)) return 'answer'
  return 'answer'
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function handleDirectAnswer(
  message: string,
  gymContext: GymContext,
): Promise<{ reply: string; thinkingSteps: string[] }> {
  const systemPrompt = buildGymSystemPrompt(gymContext)
  const reply = await claudeRespond(systemPrompt, message)
  return {
    reply,
    thinkingSteps: [`Classified as direct_answer — no gym data needed`],
  }
}

async function fetchPushPressData(apiKey: string, companyId: string): Promise<{
  members: unknown[]
  checkins: unknown[]
  enrollments: unknown[]
}> {
  const PP_BASE = 'https://api.pushpressdev.com/platform/v1'
  const headers = {
    'API-KEY': apiKey,
    'X-Company-ID': companyId,
    'Content-Type': 'application/json',
  }

  const safeFetch = async (path: string) => {
    try {
      const res = await fetch(`${PP_BASE}${path}`, { headers })
      if (!res.ok) return []
      const json = await res.json()
      return Array.isArray(json) ? json : (json?.data ?? json?.items ?? [])
    } catch {
      return []
    }
  }

  const [members, checkins, enrollments] = await Promise.all([
    safeFetch('/customers?limit=100'),
    safeFetch('/checkins?limit=200'),
    safeFetch('/enrollments?limit=100'),
  ])

  return { members, checkins, enrollments }
}

async function handleInlineQuery(
  message: string,
  gymContext: GymContext & { apiKey?: string; companyId?: string },
): Promise<{ reply: string; thinkingSteps: string[] }> {
  const thinkingSteps: string[] = ['Classified as inline_query — fetching gym data']

  let dataContext = ''

  if (gymContext.apiKey && gymContext.companyId) {
    try {
      const data = await fetchPushPressData(gymContext.apiKey, gymContext.companyId)
      thinkingSteps.push(`Fetched ${data.members.length} members, ${data.checkins.length} check-ins, ${data.enrollments.length} enrollments`)
      dataContext = `\n\nLive gym data:\nMembers (${data.members.length}): ${JSON.stringify(data.members.slice(0, 50))}\nRecent check-ins (${data.checkins.length}): ${JSON.stringify(data.checkins.slice(0, 100))}\nEnrollments (${data.enrollments.length}): ${JSON.stringify(data.enrollments.slice(0, 50))}`
    } catch (err) {
      thinkingSteps.push('PushPress data fetch failed — responding from context only')
      console.error('PushPress fetch error:', err)
    }
  } else {
    thinkingSteps.push('No PushPress credentials — responding from context only')
  }

  const systemPrompt = `${buildGymSystemPrompt(gymContext)}

You have direct access to this gym's live PushPress data. Answer the question using the actual data provided. Be specific — name real members, real numbers, real dates from the data. Do not hedge or say "I would look for" — you have the data, use it.${dataContext}`

  const reply = await claudeRespond(systemPrompt, message)
  thinkingSteps.push('Generated response from live data')

  return { reply, thinkingSteps }
}

async function handlePrebuiltSpecialist(
  message: string,
  gymContext: GymContext,
): Promise<{ reply: string; thinkingSteps: string[] }> {
  const specialistKey = pickSpecialist('prebuilt_specialist', message)
  const specialistPrompt = SPECIALIST_PROMPTS[specialistKey] ?? SPECIALIST_PROMPTS.operations

  const fullSystem = `${specialistPrompt}

Gym: ${gymContext.gymName} with ${gymContext.memberCount} members.
Be specific, practical, and data-focused. If you don't have specific data, 
explain what patterns you'd look for and what actions to take.`

  const reply = await claudeRespond(fullSystem, message)
  return {
    reply,
    thinkingSteps: [
      `Classified as prebuilt_specialist`,
      `Selected specialist: ${specialistKey}`,
      `Ran ${specialistKey} analysis`,
    ],
  }
}

async function handleDynamicSpecialist(
  message: string,
  gymContext: GymContext,
): Promise<{ reply: string; thinkingSteps: string[] }> {
  // Step 1: GM writes specialist prompt
  const gmSystemPrompt = `You are a GM Agent for a boutique gym. Write a focused system prompt for a 
specialist agent that will handle this task. Keep it under 200 words. Be specific about 
what data to look for and what to return.`

  const specialistPrompt = await claudeRespond(
    gmSystemPrompt,
    `Write a specialist system prompt for this task: "${message}"
Gym: ${gymContext.gymName}, ${gymContext.memberCount} members.
The system prompt should tell the specialist exactly what to analyze and how to format the response.`,
  )

  // Step 2: Run with specialist prompt
  const reply = await claudeRespond(
    specialistPrompt,
    `Task: ${message}\n\nGym context: ${gymContext.gymName}, ${gymContext.memberCount} members.`,
  )

  return {
    reply,
    thinkingSteps: [
      `Classified as dynamic_specialist — novel task`,
      `GM wrote custom specialist prompt`,
      `Specialist executed task`,
    ],
  }
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { message, gymId, conversationHistory } = body as {
    message?: string
    gymId?: string
    conversationHistory?: unknown[]
  }

  // Validation
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json(
      { error: 'message is required and must be a non-empty string' },
      { status: 400 },
    )
  }

  if (!gymId || typeof gymId !== 'string' || gymId.trim().length === 0) {
    return NextResponse.json(
      { error: 'gymId is required and must be a non-empty string' },
      { status: 400 },
    )
  }

  try {
    // 1. Load gym context
    const gymContext = await loadGymContext(gymId)

    // 2. Log user message
    await appendChatMessage({
      gymId,
      role: 'user',
      content: message.trim(),
    })

    // 3. Classify task
    const route: TaskRoute = await classifyTask(message.trim())

    // 4. Route to handler
    // For data-heavy routes, always try to fetch PushPress data
    let result: { reply: string; thinkingSteps: string[] }
    const richContext = gymContext as GymContext & { apiKey?: string; companyId?: string }

    switch (route) {
      case 'direct_answer':
        result = await handleDirectAnswer(message.trim(), gymContext)
        break
      case 'inline_query':
        result = await handleInlineQuery(message.trim(), richContext)
        break
      case 'prebuilt_specialist':
        // Prebuilt specialist also benefits from live data
        result = await handleInlineQuery(message.trim(), richContext)
        break
      case 'dynamic_specialist':
        result = await handleDynamicSpecialist(message.trim(), gymContext)
        break
      default:
        result = await handleDirectAnswer(message.trim(), gymContext)
    }

    const actionType = inferActionType(result.reply, route)

    // 5. Log assistant reply
    await appendChatMessage({
      gymId,
      role: 'assistant',
      content: result.reply,
      route,
      actionType,
      thinkingSteps: result.thinkingSteps,
    })

    // 6. Return response
    const response: GMChatResponse = {
      reply: result.reply,
      route,
      actionType,
      thinkingSteps: result.thinkingSteps,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[/api/gm/chat] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
