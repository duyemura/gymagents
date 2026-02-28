/**
 * follow-up-evaluator.test.ts
 *
 * Tests for AI-driven follow-up decisions.
 * Verifies the evaluator correctly parses AI responses and falls back safely.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockCreate, mockBuildEvaluationPrompt } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockBuildEvaluationPrompt: vi.fn().mockResolvedValue('System prompt with skill + memories'),
}))

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockCreate }
    constructor(_opts?: any) {}
  }
  return { default: MockAnthropic }
})

vi.mock('@/lib/skill-loader', () => ({
  buildEvaluationPrompt: mockBuildEvaluationPrompt,
}))

// ── Import after mocks ──────────────────────────────────────────────────────

import { evaluateFollowUp, type FollowUpContext } from '../follow-up-evaluator'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeContext(overrides?: Partial<FollowUpContext>): FollowUpContext {
  return {
    taskType: 'churn_risk',
    accountId: 'acct-001',
    memberName: 'Sarah Chen',
    memberEmail: 'sarah@example.com',
    conversationHistory: [
      { role: 'agent', content: 'Hey Sarah, just checking in — how are things going?' },
    ],
    messagesSent: 1,
    daysSinceLastMessage: 3,
    accountName: 'Iron Forge Fitness',
    ...overrides,
  }
}

function mockAIResponse(json: Record<string, unknown>) {
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(json) }],
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('evaluateFollowUp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBuildEvaluationPrompt.mockResolvedValue('System prompt with skill + memories')
  })

  // ── AI decides to follow up ──────────────────────────────────────────────

  it('returns follow_up with message and next check days', async () => {
    mockAIResponse({
      reasoning: 'Only one message sent 3 days ago. Skill guidelines suggest a second touch.',
      action: 'follow_up',
      message: 'Hey Sarah, quick heads up — we just launched a new Saturday class.',
      nextCheckDays: 7,
    })

    const decision = await evaluateFollowUp(makeContext())

    expect(decision.action).toBe('follow_up')
    expect(decision.message).toContain('Saturday class')
    expect(decision.nextCheckDays).toBe(7)
    expect(decision.reason).toContain('one message sent')
  })

  it('defaults nextCheckDays to 7 for follow_up if AI omits it', async () => {
    mockAIResponse({
      reasoning: 'Should follow up.',
      action: 'follow_up',
      message: 'Hey Sarah, just a quick note.',
    })

    const decision = await evaluateFollowUp(makeContext())

    expect(decision.action).toBe('follow_up')
    expect(decision.nextCheckDays).toBe(7)
  })

  it('falls back to close if AI says follow_up but gives no message', async () => {
    mockAIResponse({
      reasoning: 'Should follow up.',
      action: 'follow_up',
      // no message field
    })

    const decision = await evaluateFollowUp(makeContext())

    expect(decision.action).toBe('close')
    expect(decision.outcome).toBe('unresponsive')
  })

  // ── AI decides to close ──────────────────────────────────────────────────

  it('returns close with outcome when AI decides to stop', async () => {
    mockAIResponse({
      reasoning: 'Three messages sent over 14 days with no reply. Per guidelines, respect their silence.',
      action: 'close',
      outcome: 'unresponsive',
    })

    const decision = await evaluateFollowUp(makeContext({ messagesSent: 3, daysSinceLastMessage: 7 }))

    expect(decision.action).toBe('close')
    expect(decision.outcome).toBe('unresponsive')
    expect(decision.reason).toContain('no reply')
  })

  it('defaults outcome to unresponsive if AI omits it on close', async () => {
    mockAIResponse({
      reasoning: 'Member not engaging.',
      action: 'close',
    })

    const decision = await evaluateFollowUp(makeContext())

    expect(decision.action).toBe('close')
    expect(decision.outcome).toBe('unresponsive')
  })

  it('handles churned outcome from AI', async () => {
    mockAIResponse({
      reasoning: 'Member cancelled and has not responded. Closing as churned.',
      action: 'close',
      outcome: 'churned',
    })

    const decision = await evaluateFollowUp(makeContext())

    expect(decision.outcome).toBe('churned')
  })

  // ── AI decides to escalate ───────────────────────────────────────────────

  it('returns escalate with outcome', async () => {
    mockAIResponse({
      reasoning: 'Member seemed upset in their last message. Owner should handle this personally.',
      action: 'escalate',
    })

    const decision = await evaluateFollowUp(makeContext())

    expect(decision.action).toBe('escalate')
    expect(decision.outcome).toBe('escalated')
  })

  // ── AI decides to wait ───────────────────────────────────────────────────

  it('returns wait with next check days', async () => {
    mockAIResponse({
      reasoning: 'Only sent the first message yesterday. Too early for a follow-up.',
      action: 'wait',
      nextCheckDays: 2,
    })

    const decision = await evaluateFollowUp(makeContext({ daysSinceLastMessage: 1 }))

    expect(decision.action).toBe('wait')
    expect(decision.nextCheckDays).toBe(2)
  })

  it('defaults nextCheckDays to 3 for wait if AI omits it', async () => {
    mockAIResponse({
      reasoning: 'Let it breathe.',
      action: 'wait',
    })

    const decision = await evaluateFollowUp(makeContext())

    expect(decision.action).toBe('wait')
    expect(decision.nextCheckDays).toBe(3)
  })

  // ── Prompt assembly ──────────────────────────────────────────────────────

  it('loads evaluation prompt with account ID and member email', async () => {
    mockAIResponse({ reasoning: 'test', action: 'close', outcome: 'unresponsive' })

    await evaluateFollowUp(makeContext())

    expect(mockBuildEvaluationPrompt).toHaveBeenCalledWith('churn_risk', {
      accountId: 'acct-001',
      memberId: 'sarah@example.com',
    })
  })

  it('passes task type through to skill loader', async () => {
    mockAIResponse({ reasoning: 'test', action: 'close', outcome: 'unresponsive' })

    await evaluateFollowUp(makeContext({ taskType: 'win_back' }))

    expect(mockBuildEvaluationPrompt).toHaveBeenCalledWith('win_back', expect.any(Object))
  })

  it('includes messages sent and days since last message in prompt', async () => {
    mockAIResponse({ reasoning: 'test', action: 'close', outcome: 'unresponsive' })

    await evaluateFollowUp(makeContext({ messagesSent: 2, daysSinceLastMessage: 5 }))

    const call = mockCreate.mock.calls[0][0]
    expect(call.messages[0].content).toContain('Messages sent so far: 2')
    expect(call.messages[0].content).toContain('Days since last outbound message: 5')
  })

  it('includes conversation history in prompt', async () => {
    mockAIResponse({ reasoning: 'test', action: 'close', outcome: 'unresponsive' })

    await evaluateFollowUp(makeContext({
      conversationHistory: [
        { role: 'agent', content: 'Hey Sarah, checking in.' },
        { role: 'member', content: 'Been super busy.' },
        { role: 'agent', content: 'Totally understand!' },
      ],
    }))

    const call = mockCreate.mock.calls[0][0]
    expect(call.messages[0].content).toContain('[BUSINESS]: Hey Sarah, checking in.')
    expect(call.messages[0].content).toContain('[MEMBER]: Been super busy.')
  })

  it('includes account name and member context when provided', async () => {
    mockAIResponse({ reasoning: 'test', action: 'close', outcome: 'unresponsive' })

    await evaluateFollowUp(makeContext({
      accountName: 'CrossFit Downtown',
      memberContext: 'Last visited 18 days ago',
    }))

    const call = mockCreate.mock.calls[0][0]
    expect(call.messages[0].content).toContain('CrossFit Downtown')
    expect(call.messages[0].content).toContain('Last visited 18 days ago')
  })

  it('uses HAIKU model for cost efficiency', async () => {
    mockAIResponse({ reasoning: 'test', action: 'close', outcome: 'unresponsive' })

    await evaluateFollowUp(makeContext())

    const call = mockCreate.mock.calls[0][0]
    expect(call.model).toBe('claude-haiku-4-5-20251001')
  })

  // ── Fallback behavior ────────────────────────────────────────────────────

  it('falls back to close after 3+ messages when AI fails', async () => {
    mockCreate.mockRejectedValue(new Error('API error'))

    const decision = await evaluateFollowUp(makeContext({ messagesSent: 3 }))

    expect(decision.action).toBe('close')
    expect(decision.outcome).toBe('unresponsive')
  })

  it('falls back to wait when AI fails and few messages sent', async () => {
    mockCreate.mockRejectedValue(new Error('API error'))

    const decision = await evaluateFollowUp(makeContext({ messagesSent: 1 }))

    expect(decision.action).toBe('wait')
    expect(decision.nextCheckDays).toBe(3)
  })

  it('falls back safely when buildEvaluationPrompt fails', async () => {
    mockBuildEvaluationPrompt.mockRejectedValue(new Error('Skill file not found'))

    const decision = await evaluateFollowUp(makeContext({ messagesSent: 2 }))

    expect(decision.action).toBe('wait')
    expect(decision.nextCheckDays).toBe(3)
  })

  it('handles malformed JSON from AI gracefully', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'This is not JSON at all' }],
    })

    const decision = await evaluateFollowUp(makeContext({ messagesSent: 4 }))

    // Falls back based on messagesSent count
    expect(decision.action).toBe('close')
    expect(decision.outcome).toBe('unresponsive')
  })

  it('handles unknown action value from AI', async () => {
    mockAIResponse({
      reasoning: 'test',
      action: 'invalid_action',
    })

    const decision = await evaluateFollowUp(makeContext())

    // Unknown action defaults to 'close'
    expect(decision.action).toBe('close')
    expect(decision.outcome).toBe('unresponsive')
  })

  it('rejects invalid outcome values from AI', async () => {
    mockAIResponse({
      reasoning: 'test',
      action: 'close',
      outcome: 'made_up_outcome',
    })

    const decision = await evaluateFollowUp(makeContext())

    // Invalid outcome defaults to 'unresponsive'
    expect(decision.outcome).toBe('unresponsive')
  })
})
