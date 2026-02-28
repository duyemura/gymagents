export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { HAIKU } from '@/lib/models'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { name, description } = await req.json()
  if (!name) return new Response('name is required', { status: 400 })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const system = `You write system prompts for AI agents that help gym and fitness businesses retain members and grow revenue.

A system prompt tells the AI agent exactly what to do: what data to look at, who to focus on, what signals matter, how to communicate, and what a good outcome looks like.

Write in second person ("You are..."). 4-6 focused sentences. No headers, no bullet points, no lists. Plain prose the agent can follow directly. Be specific — don't be generic.`

  const prompt = `Write a system prompt for an AI agent named "${name}"${description ? ` described as: "${description}"` : ''}.

The agent works with a gym or fitness business. It will analyze member data from PushPress and draft personalized outreach messages for the owner to review and send.`

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
