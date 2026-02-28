/**
 * lib/memory-extractor.ts
 *
 * Reads recent conversation messages and extracts durable memory candidates
 * using Haiku. Optionally consolidates candidates against existing memories
 * so related facts extend a single card rather than creating duplicate cards.
 */

import Anthropic from '@anthropic-ai/sdk'
import { HAIKU } from './models'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: string
  content: string
}

export interface ExtractedMemory {
  content: string
  category: string
  scope: string
  importance: number
  evidence: string
  confidence: number
  memberName?: string
}

export interface ExistingMemory {
  id: string
  content: string
  category: string
}

/** A candidate ready to write to improvement_suggestions */
export interface ConsolidatedCandidate extends ExtractedMemory {
  /** If set, this should update an existing memory rather than create a new one */
  targetMemoryId?: string
  /** The merged content to show the owner when targetMemoryId is set */
  mergedContent?: string
}

// ── extractMemoriesFromConversation ───────────────────────────────────────────

export async function extractMemoriesFromConversation(
  messages: ConversationMessage[],
  context: { accountName?: string } = {},
): Promise<ExtractedMemory[]> {
  if (messages.length === 0) return []

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const formatted = messages
    .map(m => `[${m.role}]: ${m.content}`)
    .join('\n\n')

  const system = `You extract useful, durable facts from business conversations to save as AI memories.

Look for:
- Owner preferences: how they like things done, tone, style, what they want to avoid
- Member facts: specific details about individual clients (health notes, goals, quirks)
- Business context: policies, hours, culture, what is normal for this business
- Learned patterns: what works or does not work, things to remember

Only extract facts that are:
1. Durable — likely to still be true weeks from now
2. Actionable — genuinely useful for future AI decisions
3. Specific — not generic common-sense advice

Return valid JSON only — an array (empty [] if nothing useful found):
[{"content":"...","category":"preference|member_fact|gym_context|learned_pattern","scope":"global|member","importance":1-5,"evidence":"exact short quote from the conversation","confidence":0.1-1.0,"memberName":"only if member-specific, otherwise omit"}]`

  const userPrompt = `Extract memories from this conversation${context.accountName ? ` at ${context.accountName}` : ''}:\n\n${formatted}`

  try {
    const response = await client.messages.create({
      model: HAIKU,
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? '[]'
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(clean)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ── consolidateWithExisting ───────────────────────────────────────────────────
//
// Single Haiku call per account. For each candidate, decide:
//   - "create"  → genuinely new fact, create a new memory card
//   - "update"  → extends an existing memory, merge into that card
//
// Falls back to treating every candidate as "create" if the call fails.

export async function consolidateWithExisting(
  candidates: ExtractedMemory[],
  existingMemories: ExistingMemory[],
): Promise<ConsolidatedCandidate[]> {
  // Nothing to consolidate against — all are new
  if (existingMemories.length === 0) return candidates

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const existingList = existingMemories
    .map(m => `  {"id":"${m.id}","content":${JSON.stringify(m.content)},"category":"${m.category}"}`)
    .join('\n')

  const candidateList = candidates
    .map((c, i) => `  ${i}: ${JSON.stringify(c.content)}`)
    .join('\n')

  const system = `You decide whether new memory candidates should extend existing memories or create new ones.

For each candidate (by index), output one of:
- {"idx":N,"action":"create"} — genuinely new fact, no good existing home
- {"idx":N,"action":"update","targetId":"<existing id>","mergedContent":"<combined text>"} — extends an existing memory; mergedContent should be a single clear sentence combining both

Rules:
- Only merge if the candidate is truly about the same specific fact as an existing memory
- "Same topic" is not enough — prefer creating new cards over awkward merges
- mergedContent must be concise (one sentence), not a list

Return valid JSON only — array of decisions for every candidate index:
[{"idx":0,"action":"create"},{"idx":1,"action":"update","targetId":"...","mergedContent":"..."}]`

  const userPrompt = `Existing memories:\n[\n${existingList}\n]\n\nNew candidates:\n${candidateList}`

  try {
    const response = await client.messages.create({
      model: HAIKU,
      max_tokens: 600,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? '[]'
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    const decisions: Array<{ idx: number; action: string; targetId?: string; mergedContent?: string }> =
      JSON.parse(clean)

    return candidates.map((candidate, i) => {
      const decision = decisions.find(d => d.idx === i)
      if (decision?.action === 'update' && decision.targetId && decision.mergedContent) {
        return {
          ...candidate,
          targetMemoryId: decision.targetId,
          mergedContent: decision.mergedContent,
        }
      }
      return candidate
    })
  } catch {
    // Safe fallback: treat all as creates
    return candidates
  }
}
