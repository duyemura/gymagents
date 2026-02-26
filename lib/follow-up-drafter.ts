/**
 * follow-up-drafter.ts — AI-drafted follow-up messages for multi-touch sequences.
 *
 * Replaces hardcoded follow-up templates with messages drafted by Haiku
 * using the task's skill context + business memories + conversation history.
 *
 * Each follow-up is contextual: the AI reads the skill file's touch guidelines,
 * the prior messages, and any member-specific memories to craft the next message.
 */

import Anthropic from '@anthropic-ai/sdk'
import { HAIKU } from './models'
import { buildDraftingPrompt } from './skill-loader'

// ── Types ────────────────────────────────────────────────────────────────────

export interface FollowUpContext {
  /** Task type (maps to skill file) */
  taskType: string
  /** Which touch this is (2 = second message, 3 = final) */
  touchNumber: number
  /** Account ID for memory injection */
  accountId: string
  /** Member's first name */
  memberName: string
  /** Member's email */
  memberEmail: string
  /** Previous messages in the conversation (agent + member) */
  conversationHistory: { role: 'agent' | 'member'; content: string }[]
  /** Account/business name */
  accountName?: string
  /** Member-specific context from the original task */
  memberContext?: string
}

// Lazy singleton — avoids module-level init crashing Next.js build
let _anthropic: Anthropic | null = null
function getClient(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  return _anthropic
}

// ── Core ─────────────────────────────────────────────────────────────────────

/**
 * Draft a follow-up message using skill context + memories + conversation history.
 *
 * Uses Haiku for cost efficiency (~$0.001 per follow-up).
 * Falls back to a simple template if the AI call fails.
 */
export async function draftFollowUp(ctx: FollowUpContext): Promise<string> {
  try {
    // Load skill prompt with memories injected
    const systemPrompt = await buildDraftingPrompt(ctx.taskType, {
      accountId: ctx.accountId,
    })

    const conversationBlock = ctx.conversationHistory.length > 0
      ? ctx.conversationHistory
          .map(m => `${m.role === 'agent' ? 'You' : 'Member'}: ${m.content}`)
          .join('\n\n')
      : '(No replies received)'

    const userPrompt = `You are writing Touch ${ctx.touchNumber} in a multi-touch sequence to ${ctx.memberName} (${ctx.memberEmail}).
${ctx.accountName ? `Business: ${ctx.accountName}` : ''}
${ctx.memberContext ? `Context: ${ctx.memberContext}` : ''}

Previous conversation:
${conversationBlock}

Important:
- This is Touch ${ctx.touchNumber} — follow the Touch ${ctx.touchNumber} guidelines from the skill above
- Do NOT repeat what was already said in previous touches
- Keep the voice natural and warm — this should sound like the business owner, not a bot
- Return ONLY the message text — no subject line, no explanation`

    const response = await getClient().messages.create({
      model: HAIKU,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const block = response.content.find(b => b.type === 'text')
    const text = block?.type === 'text' ? block.text.trim() : ''

    if (text.length > 0) return text
  } catch (err) {
    console.warn('[follow-up-drafter] AI drafting failed, using fallback:', (err as Error).message)
  }

  // Fallback — simple templates if AI fails
  return fallbackMessage(ctx.memberName, ctx.touchNumber)
}

function fallbackMessage(memberName: string, touchNumber: number): string {
  const firstName = memberName.split(' ')[0] ?? 'there'
  if (touchNumber === 2) {
    return `Hey ${firstName}, I know things change and that's OK. If there's anything we could do differently, I'd love to hear it. No pressure at all.`
  }
  return `Hey ${firstName}, just wanted you to know the door's always open. If you ever want to come back, we'll be here. Wishing you the best.`
}
