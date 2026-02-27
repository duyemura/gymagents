export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { HAIKU } from '@/lib/models'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { goal, successMetric } = await req.json()
  if (!goal) return new Response('goal is required', { status: 400 })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const system = `You write system prompts for AI agents that help gym owners retain members, recover revenue, and grow their gym.

A system prompt tells the AI agent exactly what to do: what to look for in the gym's member data, what signals matter (attendance drops, missed classes, payment failures, new member onboarding), how to act, and what a good outcome looks like.

Write in second person ("You are..."). 4-6 focused sentences. No headers, no bullet points, no lists. Plain prose the agent can follow directly. Be specific to what the gym owner described — don't be generic or add things they didn't ask for. Use gym/fitness terminology naturally (members, check-ins, classes, coaches, workouts).`

  const prompt = `Write a system prompt for an AI agent at a gym.

What the gym owner wants it to do: ${goal}
${successMetric ? `What success looks like: ${successMetric}` : ''}

The agent has access to PushPress gym data (members, check-ins, classes, payments) and can draft personal messages, analyze attendance patterns, flag at-risk members, and surface insights for the gym owner to act on.`

  const stream = client.messages.stream({
    model: HAIKU,
    max_tokens: 600,
    system,
    messages: [{ role: 'user', content: prompt }],
  })

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text))
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
