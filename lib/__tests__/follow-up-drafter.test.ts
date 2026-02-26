/**
 * follow-up-drafter.test.ts
 *
 * Tests for AI-drafted follow-up messages.
 * Verifies prompt assembly, Haiku call, and fallback behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockCreate, mockBuildDraftingPrompt } = vi.hoisted(() => ({
  mockCreate: vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'Hey Sarah, just a quick note...' }],
  }),
  mockBuildDraftingPrompt: vi.fn().mockResolvedValue('System prompt with skill + memories'),
}))

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockCreate }
    constructor(_opts?: any) {}
  }
  return { default: MockAnthropic }
})

vi.mock('@/lib/skill-loader', () => ({
  buildDraftingPrompt: mockBuildDraftingPrompt,
}))

// ── Import after mocks ──────────────────────────────────────────────────────

import { draftFollowUp, type FollowUpContext } from '../follow-up-drafter'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeContext(overrides?: Partial<FollowUpContext>): FollowUpContext {
  return {
    taskType: 'churn_risk',
    touchNumber: 2,
    accountId: 'acct-001',
    memberName: 'Sarah Chen',
    memberEmail: 'sarah@example.com',
    conversationHistory: [
      { role: 'agent', content: 'Hey Sarah, just checking in — how are things going?' },
    ],
    accountName: 'Iron Forge Fitness',
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('draftFollowUp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Hey Sarah, just a quick note...' }],
    })
    mockBuildDraftingPrompt.mockResolvedValue('System prompt with skill + memories')
  })

  it('returns AI-drafted message on success', async () => {
    const result = await draftFollowUp(makeContext())

    expect(result).toBe('Hey Sarah, just a quick note...')
    expect(mockBuildDraftingPrompt).toHaveBeenCalledWith('churn_risk', { accountId: 'acct-001' })
  })

  it('passes the correct touch number in the user prompt', async () => {
    await draftFollowUp(makeContext({ touchNumber: 3 }))

    const call = mockCreate.mock.calls[0][0]
    const userContent = call.messages[0].content
    expect(userContent).toContain('Touch 3')
    expect(userContent).toContain('Touch 3 guidelines')
  })

  it('includes conversation history in the prompt', async () => {
    await draftFollowUp(makeContext({
      conversationHistory: [
        { role: 'agent', content: 'Hey Sarah, checking in.' },
        { role: 'member', content: 'Been busy, will try to come in.' },
      ],
    }))

    const call = mockCreate.mock.calls[0][0]
    const userContent = call.messages[0].content
    expect(userContent).toContain('You: Hey Sarah, checking in.')
    expect(userContent).toContain('Member: Been busy, will try to come in.')
  })

  it('includes member context when provided', async () => {
    await draftFollowUp(makeContext({ memberContext: 'Last visited 18 days ago, used to come 3x/week' }))

    const call = mockCreate.mock.calls[0][0]
    expect(call.messages[0].content).toContain('Last visited 18 days ago')
  })

  it('includes account name when provided', async () => {
    await draftFollowUp(makeContext({ accountName: 'CrossFit Downtown' }))

    const call = mockCreate.mock.calls[0][0]
    expect(call.messages[0].content).toContain('CrossFit Downtown')
  })

  it('handles empty conversation history', async () => {
    await draftFollowUp(makeContext({ conversationHistory: [] }))

    const call = mockCreate.mock.calls[0][0]
    expect(call.messages[0].content).toContain('(No replies received)')
  })

  it('uses HAIKU model for cost efficiency', async () => {
    await draftFollowUp(makeContext())

    const call = mockCreate.mock.calls[0][0]
    expect(call.model).toBe('claude-haiku-4-5-20251001')
  })

  it('uses system prompt from buildDraftingPrompt', async () => {
    await draftFollowUp(makeContext())

    const call = mockCreate.mock.calls[0][0]
    expect(call.system).toBe('System prompt with skill + memories')
  })

  // ── Fallback ─────────────────────────────────────────────────────────────

  it('falls back to template when AI call fails', async () => {
    mockCreate.mockRejectedValue(new Error('API error'))

    const result = await draftFollowUp(makeContext({ touchNumber: 2, memberName: 'Alex Kim' }))

    expect(result).toContain('Hey Alex')
    expect(result).toContain("I'd love to hear it")
  })

  it('falls back to template when AI returns empty text', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: '' }] })

    const result = await draftFollowUp(makeContext({ touchNumber: 3, memberName: 'Jordan Lee' }))

    expect(result).toContain('Hey Jordan')
    expect(result).toContain("door's always open")
  })

  it('falls back to template when buildDraftingPrompt fails', async () => {
    mockBuildDraftingPrompt.mockRejectedValue(new Error('Skill file not found'))

    const result = await draftFollowUp(makeContext({ touchNumber: 2, memberName: 'Sam' }))

    expect(result).toContain('Hey Sam')
  })

  it('falls back correctly for touch 2 vs touch 3', async () => {
    mockCreate.mockRejectedValue(new Error('fail'))

    const touch2 = await draftFollowUp(makeContext({ touchNumber: 2, memberName: 'Pat' }))
    const touch3 = await draftFollowUp(makeContext({ touchNumber: 3, memberName: 'Pat' }))

    expect(touch2).toContain("I'd love to hear it")
    expect(touch3).toContain("door's always open")
    expect(touch2).not.toBe(touch3)
  })

  it('passes task type through to skill loader', async () => {
    await draftFollowUp(makeContext({ taskType: 'win_back' }))

    expect(mockBuildDraftingPrompt).toHaveBeenCalledWith('win_back', { accountId: 'acct-001' })
  })
})
