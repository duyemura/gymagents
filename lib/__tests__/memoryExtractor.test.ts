/**
 * memoryExtractor.test.ts
 *
 * Unit tests for lib/memory-extractor.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  extractMemoriesFromConversation,
  consolidateWithExisting,
  type ConversationMessage,
  type ExtractedMemory,
  type ExistingMemory,
} from '../memory-extractor'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockCreate }
    constructor(_opts?: any) {}
  }
  return { default: MockAnthropic }
})

vi.mock('../models', () => ({
  HAIKU: 'claude-haiku-4-5-20251001',
  SONNET: 'claude-sonnet-4-6',
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMessages(overrides?: Partial<ConversationMessage>[]): ConversationMessage[] {
  return (overrides ?? []).map(o => ({ role: 'owner', content: 'test content', ...o }))
}

function makeAIResponse(memories: any[]) {
  return {
    content: [{ type: 'text', text: JSON.stringify(memories) }],
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('extractMemoriesFromConversation', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('returns empty array when no messages provided', async () => {
    const result = await extractMemoriesFromConversation([])
    expect(result).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('calls Haiku with messages and returns parsed memories', async () => {
    const expected = [
      {
        content: 'Always sign off messages as Coach Mike',
        category: 'preference',
        scope: 'global',
        importance: 4,
        evidence: 'sign off as Coach Mike',
        confidence: 0.9,
      },
    ]
    mockCreate.mockResolvedValueOnce(makeAIResponse(expected))

    const messages = makeMessages([
      { role: 'owner', content: 'When you send emails, always sign off as Coach Mike' },
    ])

    const result = await extractMemoriesFromConversation(messages, { accountName: 'Test Gym' })

    expect(mockCreate).toHaveBeenCalledOnce()
    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.model).toBe('claude-haiku-4-5-20251001')
    expect(callArgs.messages[0].content).toContain('Coach Mike')
    expect(callArgs.messages[0].content).toContain('Test Gym')

    expect(result).toEqual(expected)
  })

  it('returns empty array when AI returns empty array', async () => {
    mockCreate.mockResolvedValueOnce(makeAIResponse([]))

    const result = await extractMemoriesFromConversation(
      makeMessages([{ content: 'Hey how is it going' }]),
    )
    expect(result).toEqual([])
  })

  it('strips markdown fencing from AI response', async () => {
    const memory = {
      content: 'Members prefer morning classes',
      category: 'learned_pattern',
      scope: 'global',
      importance: 3,
      evidence: 'morning classes',
      confidence: 0.75,
    }
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '```json\n[' + JSON.stringify(memory) + ']\n```' }],
    })

    const result = await extractMemoriesFromConversation(makeMessages([{ content: 'members prefer mornings' }]))
    expect(result).toEqual([memory])
  })

  it('returns empty array when AI returns malformed JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not valid json at all' }],
    })

    const result = await extractMemoriesFromConversation(
      makeMessages([{ content: 'test message' }]),
    )
    expect(result).toEqual([])
  })

  it('returns empty array when AI returns non-array JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"error": "nothing found"}' }],
    })

    const result = await extractMemoriesFromConversation(
      makeMessages([{ content: 'test message' }]),
    )
    expect(result).toEqual([])
  })

  it('returns empty array when Anthropic call throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API error'))

    const result = await extractMemoriesFromConversation(
      makeMessages([{ content: 'test message' }]),
    )
    expect(result).toEqual([])
  })

  it('formats messages as [role]: content in the prompt', async () => {
    mockCreate.mockResolvedValueOnce(makeAIResponse([]))

    const messages: ConversationMessage[] = [
      { role: 'owner (GM chat)', content: 'Please be more casual in tone' },
      { role: 'owner (task note)', content: 'Alex prefers evenings' },
    ]

    await extractMemoriesFromConversation(messages)

    const prompt = mockCreate.mock.calls[0][0].messages[0].content
    expect(prompt).toContain('[owner (GM chat)]: Please be more casual in tone')
    expect(prompt).toContain('[owner (task note)]: Alex prefers evenings')
  })

  it('includes memberName in returned memory when AI provides it', async () => {
    const memory = {
      content: 'Alex prefers early morning sessions',
      category: 'member_fact',
      scope: 'member',
      importance: 3,
      evidence: 'early morning',
      confidence: 0.8,
      memberName: 'Alex',
    }
    mockCreate.mockResolvedValueOnce(makeAIResponse([memory]))

    const result = await extractMemoriesFromConversation(
      makeMessages([{ content: 'Alex always wants early morning' }]),
    )
    expect(result[0].memberName).toBe('Alex')
  })
})

// ── consolidateWithExisting ───────────────────────────────────────────────────

function makeCandidate(overrides?: Partial<ExtractedMemory>): ExtractedMemory {
  return {
    content: 'Always sign off as Coach Mike',
    category: 'preference',
    scope: 'global',
    importance: 4,
    evidence: 'sign off as Coach Mike',
    confidence: 0.9,
    ...overrides,
  }
}

function makeExisting(overrides?: Partial<ExistingMemory>): ExistingMemory {
  return {
    id: 'mem-001',
    content: 'Sign messages as Mike',
    category: 'preference',
    ...overrides,
  }
}

describe('consolidateWithExisting', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('returns candidates unchanged when no existing memories', async () => {
    const candidates = [makeCandidate()]
    const result = await consolidateWithExisting(candidates, [])
    expect(result).toEqual(candidates)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('calls Haiku once with existing memories and candidates', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '[{"idx":0,"action":"create"}]' }],
    })
    const candidates = [makeCandidate()]
    const existing = [makeExisting()]

    await consolidateWithExisting(candidates, existing)

    expect(mockCreate).toHaveBeenCalledOnce()
    const prompt = mockCreate.mock.calls[0][0].messages[0].content
    expect(prompt).toContain('mem-001')
    expect(prompt).toContain('Sign messages as Mike')
    expect(prompt).toContain('Always sign off as Coach Mike')
  })

  it('marks candidate with targetMemoryId and mergedContent on update decision', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: '[{"idx":0,"action":"update","targetId":"mem-001","mergedContent":"Always sign off as Coach Mike, owner preferred"}]',
      }],
    })

    const result = await consolidateWithExisting([makeCandidate()], [makeExisting()])

    expect(result[0].targetMemoryId).toBe('mem-001')
    expect(result[0].mergedContent).toBe('Always sign off as Coach Mike, owner preferred')
  })

  it('leaves candidate without targetMemoryId on create decision', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '[{"idx":0,"action":"create"}]' }],
    })

    const result = await consolidateWithExisting([makeCandidate()], [makeExisting()])

    expect(result[0].targetMemoryId).toBeUndefined()
    expect(result[0].mergedContent).toBeUndefined()
  })

  it('handles mixed create and update decisions across multiple candidates', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: '[{"idx":0,"action":"create"},{"idx":1,"action":"update","targetId":"mem-002","mergedContent":"merged text"}]',
      }],
    })

    const candidates = [
      makeCandidate({ content: 'New unrelated fact' }),
      makeCandidate({ content: 'Extension of existing' }),
    ]
    const existing = [
      makeExisting({ id: 'mem-001' }),
      makeExisting({ id: 'mem-002', content: 'Some existing memory' }),
    ]

    const result = await consolidateWithExisting(candidates, existing)

    expect(result[0].targetMemoryId).toBeUndefined()
    expect(result[1].targetMemoryId).toBe('mem-002')
    expect(result[1].mergedContent).toBe('merged text')
  })

  it('falls back to treating all candidates as creates on malformed AI response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not valid json' }],
    })

    const candidates = [makeCandidate()]
    const result = await consolidateWithExisting(candidates, [makeExisting()])

    expect(result).toEqual(candidates)
    expect(result[0].targetMemoryId).toBeUndefined()
  })

  it('falls back gracefully when Anthropic call throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API timeout'))

    const candidates = [makeCandidate()]
    const result = await consolidateWithExisting(candidates, [makeExisting()])

    expect(result).toEqual(candidates)
  })
})
