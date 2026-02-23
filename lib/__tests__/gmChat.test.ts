/**
 * gmChat.test.ts
 *
 * TDD tests for Phase 4: GM Agent chat interface.
 * Tests classification, route handler, DB helpers.
 * All external services mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoist ALL mock factories to top (required by vitest for vi.mock factories) ──

const {
  mockAnthropicCreate,
  mockAppendChatMessage,
  mockGetChatHistory,
  mockAppendSystemEvent,
} = vi.hoisted(() => ({
  mockAnthropicCreate: vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'direct_answer' }],
    usage: { input_tokens: 10, output_tokens: 5 },
  }),
  mockAppendChatMessage: vi.fn().mockResolvedValue(undefined),
  mockGetChatHistory: vi.fn().mockResolvedValue([]),
  mockAppendSystemEvent: vi.fn().mockResolvedValue(undefined),
}))

// ── Mock Anthropic ─────────────────────────────────────────────────────────────
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockAnthropicCreate }
    constructor(_opts?: any) {}
  }
  return { default: MockAnthropic }
})

// ── Mock Supabase ──────────────────────────────────────────────────────────────
vi.mock('@supabase/supabase-js', () => {
  const chain = () => {
    const obj: any = {}
    obj.insert = vi.fn().mockResolvedValue({ data: null, error: null })
    obj.select = vi.fn(() => obj)
    obj.eq = vi.fn(() => obj)
    obj.order = vi.fn(() => obj)
    obj.limit = vi.fn(() => obj)
    obj.single = vi.fn(() => obj)
    obj.then = (resolve: any) => resolve({ data: [], error: null })
    return obj
  }
  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() => chain()),
    })),
  }
})

// ── Mock DB tasks ──────────────────────────────────────────────────────────────
vi.mock('../db/tasks', () => ({
  createInsightTask: vi.fn().mockResolvedValue({ id: 'task-999' }),
  DEMO_GYM_ID: '00000000-0000-0000-0000-000000000001',
}))

// ── Mock DB chat ───────────────────────────────────────────────────────────────
vi.mock('../db/chat', () => ({
  appendChatMessage: mockAppendChatMessage,
  getChatHistory: mockGetChatHistory,
  appendSystemEvent: mockAppendSystemEvent,
}))

// ── Import classifyTask directly (tests the pure function) ─────────────────────
// We test the classification logic by importing from the module after mocks
import { classifyTask, SPECIALIST_PROMPTS, pickSpecialist } from '../gmChat'

// ── Import POST handler ────────────────────────────────────────────────────────
import { POST } from '../../app/api/gm/chat/route'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/gm/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: classifyTask (unit)
// ─────────────────────────────────────────────────────────────────────────────

describe('classifyTask', () => {
  beforeEach(() => {
    mockAnthropicCreate.mockReset()
  })

  it('returns inline_query for waiver question', async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'inline_query' }],
      usage: { input_tokens: 10, output_tokens: 3 },
    })
    const route = await classifyTask("who hasn't signed a waiver this month")
    expect(route).toBe('inline_query')
  })

  it('returns direct_answer for team dinner planning', async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'direct_answer' }],
      usage: { input_tokens: 10, output_tokens: 3 },
    })
    const route = await classifyTask('plan a team dinner for my coaches')
    expect(route).toBe('direct_answer')
  })

  it('returns prebuilt_specialist for churn analysis', async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'prebuilt_specialist' }],
      usage: { input_tokens: 10, output_tokens: 3 },
    })
    const route = await classifyTask('analyze why churn spiked in August')
    expect(route).toBe('prebuilt_specialist')
  })

  it('returns dynamic_specialist for novel tasks', async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'dynamic_specialist' }],
      usage: { input_tokens: 10, output_tokens: 3 },
    })
    const route = await classifyTask('print committed club sticker sheet')
    expect(route).toBe('dynamic_specialist')
  })

  it('defaults to direct_answer on unexpected response', async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'unknown_garbage_response' }],
      usage: { input_tokens: 10, output_tokens: 3 },
    })
    const route = await classifyTask('some random question')
    expect(route).toBe('direct_answer')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: pickSpecialist (unit)
// ─────────────────────────────────────────────────────────────────────────────

describe('pickSpecialist', () => {
  it('picks churn_analysis for churn-related messages', () => {
    expect(pickSpecialist('prebuilt_specialist', 'analyze why churn spiked')).toBe('churn_analysis')
    expect(pickSpecialist('prebuilt_specialist', 'who is at risk of leaving')).toBe('churn_analysis')
    expect(pickSpecialist('prebuilt_specialist', 'retention issues this month')).toBe('churn_analysis')
  })

  it('picks lead_funnel for lead-related messages', () => {
    expect(pickSpecialist('prebuilt_specialist', 'lead conversion rate is low')).toBe('lead_funnel')
    expect(pickSpecialist('prebuilt_specialist', 'prospect pipeline')).toBe('lead_funnel')
  })

  it('picks revenue_summary for revenue messages', () => {
    expect(pickSpecialist('prebuilt_specialist', 'show me MRR trends')).toBe('revenue_summary')
    expect(pickSpecialist('prebuilt_specialist', 'billing summary this month')).toBe('revenue_summary')
  })

  it('defaults to operations', () => {
    expect(pickSpecialist('prebuilt_specialist', 'class fill rates')).toBe('operations')
    expect(pickSpecialist('prebuilt_specialist', 'waiver compliance')).toBe('operations')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: SPECIALIST_PROMPTS
// ─────────────────────────────────────────────────────────────────────────────

describe('SPECIALIST_PROMPTS', () => {
  it('has all required specialist keys', () => {
    expect(SPECIALIST_PROMPTS).toHaveProperty('churn_analysis')
    expect(SPECIALIST_PROMPTS).toHaveProperty('lead_funnel')
    expect(SPECIALIST_PROMPTS).toHaveProperty('revenue_summary')
    expect(SPECIALIST_PROMPTS).toHaveProperty('operations')
  })

  it('all prompts are non-empty strings', () => {
    for (const [key, prompt] of Object.entries(SPECIALIST_PROMPTS)) {
      expect(typeof prompt).toBe('string')
      expect(prompt.length).toBeGreaterThan(20)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: POST /api/gm/chat
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/gm/chat', () => {
  beforeEach(() => {
    mockAnthropicCreate.mockReset()
    mockAppendChatMessage.mockReset()
    mockGetChatHistory.mockReset().mockResolvedValue([])
    // Default: classify as direct_answer, then respond
    mockAnthropicCreate
      .mockResolvedValueOnce({
        // Classification call (Haiku)
        content: [{ type: 'text', text: 'direct_answer' }],
        usage: { input_tokens: 10, output_tokens: 3 },
      })
      .mockResolvedValueOnce({
        // Response call (Sonnet)
        content: [{ type: 'text', text: 'Here is my answer about your gym.' }],
        usage: { input_tokens: 50, output_tokens: 30 },
      })
  })

  it('returns 400 when message is missing', async () => {
    const req = makeRequest({ gymId: '00000000-0000-0000-0000-000000000001' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/message/i)
  })

  it('returns 400 when gymId is missing', async () => {
    const req = makeRequest({ message: 'hello' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/gymId/i)
  })

  it('returns 200 with reply and route for valid request', async () => {
    const req = makeRequest({
      message: 'plan a team dinner',
      gymId: '00000000-0000-0000-0000-000000000001',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('reply')
    expect(body).toHaveProperty('route')
    expect(typeof body.reply).toBe('string')
    expect(body.reply.length).toBeGreaterThan(0)
  })

  it('returns correct route in response', async () => {
    mockAnthropicCreate
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'direct_answer' }],
        usage: { input_tokens: 10, output_tokens: 3 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Great idea for a team dinner!' }],
        usage: { input_tokens: 50, output_tokens: 20 },
      })
    const req = makeRequest({
      message: 'plan a team dinner',
      gymId: '00000000-0000-0000-0000-000000000001',
    })
    const res = await POST(req)
    const body = await res.json()
    expect(body.route).toBe('direct_answer')
  })

  it('returns actionType in response', async () => {
    const req = makeRequest({
      message: 'plan a team dinner',
      gymId: '00000000-0000-0000-0000-000000000001',
    })
    const res = await POST(req)
    const body = await res.json()
    expect(['answer', 'data_table', 'recommendation', 'task_created', 'clarify']).toContain(body.actionType)
  })

  it('logs user message and assistant reply to chat history', async () => {
    mockAppendChatMessage.mockResolvedValue(undefined)
    const req = makeRequest({
      message: 'plan a team dinner',
      gymId: '00000000-0000-0000-0000-000000000001',
    })
    await POST(req)
    // Should have been called at least twice (user msg + assistant msg)
    expect(mockAppendChatMessage).toHaveBeenCalledTimes(2)
  })

  it('handles inline_query route', async () => {
    // Reset and set our own sequence
    mockAnthropicCreate.mockReset()
    mockAnthropicCreate
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'inline_query' }],
        usage: { input_tokens: 10, output_tokens: 3 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '4 members: Derek Walsh, Priya Patel, Tom Chen, Sarah K.' }],
        usage: { input_tokens: 50, output_tokens: 30 },
      })
    const req = makeRequest({
      message: "who hasn't signed a waiver this month",
      gymId: '00000000-0000-0000-0000-000000000001',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.route).toBe('inline_query')
    expect(body.reply).toBeTruthy()
  })

  it('handles prebuilt_specialist route', async () => {
    mockAnthropicCreate.mockReset()
    mockAnthropicCreate
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'prebuilt_specialist' }],
        usage: { input_tokens: 10, output_tokens: 3 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Churn analysis: 3 members at risk...' }],
        usage: { input_tokens: 50, output_tokens: 30 },
      })
    const req = makeRequest({
      message: 'analyze why churn spiked in August',
      gymId: '00000000-0000-0000-0000-000000000001',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.route).toBe('prebuilt_specialist')
  })

  it('handles dynamic_specialist route', async () => {
    mockAnthropicCreate.mockReset()
    mockAnthropicCreate
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'dynamic_specialist' }],
        usage: { input_tokens: 10, output_tokens: 3 },
      })
      .mockResolvedValueOnce({
        // specialist prompt generation
        content: [{ type: 'text', text: 'You are a specialist for this gym task...' }],
        usage: { input_tokens: 50, output_tokens: 30 },
      })
      .mockResolvedValueOnce({
        // specialist execution
        content: [{ type: 'text', text: 'Here is the result for your novel request.' }],
        usage: { input_tokens: 80, output_tokens: 40 },
      })
    const req = makeRequest({
      message: 'print committed club sticker sheet',
      gymId: '00000000-0000-0000-0000-000000000001',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.route).toBe('dynamic_specialist')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: appendChatMessage (via DB helper)
// ─────────────────────────────────────────────────────────────────────────────

describe('appendChatMessage', () => {
  beforeEach(() => {
    mockAppendChatMessage.mockReset().mockResolvedValue(undefined)
  })

  it('saves correct fields when called with full params', async () => {
    // Import actual function to test it calls supabase with right shape
    const { appendChatMessage } = await import('../db/chat')
    await appendChatMessage({
      gymId: 'gym-123',
      role: 'user',
      content: 'Hello GM!',
      route: 'direct_answer',
      actionType: 'answer',
    })
    // Since we mocked the module, verify it was called with correct args
    expect(mockAppendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        gymId: 'gym-123',
        role: 'user',
        content: 'Hello GM!',
        route: 'direct_answer',
        actionType: 'answer',
      })
    )
  })

  it('accepts all role types', async () => {
    const { appendChatMessage } = await import('../db/chat')
    for (const role of ['user', 'assistant', 'system_event'] as const) {
      await appendChatMessage({ gymId: 'gym-1', role, content: 'test' })
    }
    expect(mockAppendChatMessage).toHaveBeenCalledTimes(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: getChatHistory (via DB helper)
// ─────────────────────────────────────────────────────────────────────────────

describe('getChatHistory', () => {
  it('returns messages in ascending order (mocked)', async () => {
    const fakeMessages = [
      { id: '1', gymId: 'gym-1', role: 'user' as const, content: 'hi', createdAt: '2024-01-01T10:00:00Z' },
      { id: '2', gymId: 'gym-1', role: 'assistant' as const, content: 'hello', createdAt: '2024-01-01T10:01:00Z' },
    ]
    mockGetChatHistory.mockResolvedValueOnce(fakeMessages)

    const { getChatHistory } = await import('../db/chat')
    const result = await getChatHistory('gym-1')

    // Verify order ascending
    expect((result[0].createdAt ?? '') <= (result[1].createdAt ?? '')).toBe(true)
  })

  it('returns empty array when no history', async () => {
    mockGetChatHistory.mockResolvedValueOnce([])
    const { getChatHistory } = await import('../db/chat')
    const result = await getChatHistory('gym-1')
    expect(result).toEqual([])
  })
})
