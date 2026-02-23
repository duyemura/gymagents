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

async function loadGymContext(gymId: string): Promise<GymContext> {
  try {
    const { data } = await supabaseAdmin
      .from('gyms')
      .select('gym_name, member_count')
      .eq('id', gymId)
      .single()

    return {
      gymId,
      gymName: data?.gym_name ?? 'Your Gym',
      memberCount: data?.member_count ?? 0,
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

async function handleInlineQuery(
  message: string,
  gymContext: GymContext,
): Promise<{ reply: string; thinkingSteps: string[] }> {
  // For now, respond with Sonnet using gym context
  // In production, this would fetch PushPress data first
  const systemPrompt = `${buildGymSystemPrompt(gymContext)}

You have access to the gym's data. When asked about specific member data, provide helpful context
about what you would look for. If data is unavailable in this context, say so clearly and
explain what the answer would typically look like.`

  const reply = await claudeRespond(systemPrompt, message)
  return {
    reply,
    thinkingSteps: [
      `Classified as inline_query — needs data lookup`,
      `Responded based on available gym context`,
    ],
  }
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
    let result: { reply: string; thinkingSteps: string[] }

    switch (route) {
      case 'direct_answer':
        result = await handleDirectAnswer(message.trim(), gymContext)
        break
      case 'inline_query':
        result = await handleInlineQuery(message.trim(), gymContext)
        break
      case 'prebuilt_specialist':
        result = await handlePrebuiltSpecialist(message.trim(), gymContext)
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
