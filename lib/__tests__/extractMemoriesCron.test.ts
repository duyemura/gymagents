/**
 * extractMemoriesCron.test.ts
 *
 * Tests for POST /api/cron/extract-memories
 * Validates auth, scans both conversation sources, consolidates against existing
 * memories, writes improvement_suggestions, and dedupes against pending ones.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockExtract, mockConsolidate } = vi.hoisted(() => ({
  mockExtract: vi.fn(),
  mockConsolidate: vi.fn(),
}))

vi.mock('../memory-extractor', () => ({
  extractMemoriesFromConversation: mockExtract,
  consolidateWithExisting: mockConsolidate,
}))

vi.mock('@/lib/db/memories', () => ({
  getAccountMemories: vi.fn().mockResolvedValue([]),
}))

// ── Supabase mock ─────────────────────────────────────────────────────────────

let mockAccounts: any[] = []
let mockGmMessages: any[] = []
let mockTaskMessages: any[] = []
let mockExistingSuggestions: any[] = []
let insertedSuggestions: any[] = []

function makeChain(data: any) {
  const obj: any = {}
  const methods = [
    'select', 'eq', 'not', 'gte', 'order', 'limit', 'update',
    'single', 'maybeSingle', 'filter', 'in', 'is',
  ]
  methods.forEach(m => { obj[m] = vi.fn().mockReturnValue(obj) })
  obj.then = (resolve: any) => resolve(data)
  return obj
}

function makeInsertChain() {
  const obj: any = {}
  const methods = [
    'select', 'eq', 'not', 'gte', 'order', 'limit', 'update',
    'single', 'maybeSingle', 'filter', 'in', 'is',
  ]
  methods.forEach(m => { obj[m] = vi.fn().mockReturnValue(obj) })
  obj.insert = vi.fn((rows: any) => {
    insertedSuggestions.push(...(Array.isArray(rows) ? rows : [rows]))
    return obj
  })
  obj.then = (resolve: any) => resolve({ data: mockExistingSuggestions, error: null })
  return obj
}

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'accounts') return makeChain({ data: mockAccounts, error: null })
      if (table === 'gm_chat_messages') return makeChain({ data: mockGmMessages, error: null })
      if (table === 'task_conversations') return makeChain({ data: mockTaskMessages, error: null })
      if (table === 'improvement_suggestions') return makeInsertChain()
      return makeChain({ data: null, error: null })
    }),
  },
}))

// ── Import after mocks ────────────────────────────────────────────────────────

import { POST } from '../../app/api/cron/extract-memories/route'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(secret?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (secret !== undefined) headers['authorization'] = `Bearer ${secret}`
  return new NextRequest('http://localhost/api/cron/extract-memories', { method: 'POST', headers })
}

function makeMemoryCandidate(overrides?: any) {
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/cron/extract-memories', () => {
  beforeEach(() => {
    mockExtract.mockReset()
    mockConsolidate.mockReset()
    insertedSuggestions = []
    mockExistingSuggestions = []

    mockAccounts = [{ id: 'acct-001', account_name: 'Test Gym' }]
    mockGmMessages = [{ role: 'user', content: 'When you send emails, sign off as Coach Mike' }]
    mockTaskMessages = []

    // By default consolidate is a passthrough
    const candidate = makeMemoryCandidate()
    mockExtract.mockResolvedValue([candidate])
    mockConsolidate.mockImplementation(async (candidates: any[]) => candidates)
  })

  // ── Auth ──────────────────────────────────────────────────────────────────

  it('returns 401 when no authorization header', async () => {
    const res = await POST(makeRequest(undefined))
    expect(res.status).toBe(401)
  })

  it('returns 401 when wrong secret', async () => {
    const res = await POST(makeRequest('wrong-secret'))
    expect(res.status).toBe(401)
  })

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns 200 with summary when authenticated and has messages', async () => {
    const res = await POST(makeRequest('test-cron-secret'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, accountsProcessed: 1, totalExtracted: 1 })
  })

  it('calls extractMemoriesFromConversation with combined messages from both sources', async () => {
    mockTaskMessages = [{ role: 'owner', content: 'Alex prefers evenings' }]
    await POST(makeRequest('test-cron-secret'))

    expect(mockExtract).toHaveBeenCalledOnce()
    const [messages, context] = mockExtract.mock.calls[0]
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('owner (GM chat)')
    expect(messages[1].role).toBe('owner (task note)')
    expect(context.accountName).toBe('Test Gym')
  })

  it('calls consolidateWithExisting after extraction', async () => {
    await POST(makeRequest('test-cron-secret'))
    expect(mockConsolidate).toHaveBeenCalledOnce()
  })

  it('inserts suggestions with correct shape', async () => {
    await POST(makeRequest('test-cron-secret'))

    expect(insertedSuggestions).toHaveLength(1)
    expect(insertedSuggestions[0]).toMatchObject({
      account_id: 'acct-001',
      suggestion_type: 'memory',
      status: 'pending',
      privacy_tier: 'account_private',
      source: 'conversation_extraction',
      auto_apply_eligible: false,
    })
    expect(insertedSuggestions[0].proposed_change.content).toBe('Always sign off as Coach Mike')
    expect(insertedSuggestions[0].evidence.source).toBe('conversation_extraction')
  })

  it('uses mergedContent as the display content when candidate has targetMemoryId', async () => {
    mockConsolidate.mockResolvedValue([
      makeMemoryCandidate({
        targetMemoryId: 'mem-001',
        mergedContent: 'Sign emails as Coach Mike and use a warm tone',
      }),
    ])

    await POST(makeRequest('test-cron-secret'))

    expect(insertedSuggestions[0].proposed_change.content).toBe(
      'Sign emails as Coach Mike and use a warm tone',
    )
    expect(insertedSuggestions[0].proposed_change.targetMemoryId).toBe('mem-001')
    expect(insertedSuggestions[0].description).toContain('update to an existing memory')
  })

  it('assigns evidence_strength based on confidence', async () => {
    mockConsolidate.mockImplementation(async (candidates: any[]) => candidates)
    mockExtract.mockResolvedValue([
      makeMemoryCandidate({ confidence: 0.9 }),
      makeMemoryCandidate({ content: 'moderate signal', confidence: 0.65 }),
      makeMemoryCandidate({ content: 'weak signal', confidence: 0.3 }),
    ])

    await POST(makeRequest('test-cron-secret'))

    expect(insertedSuggestions[0].evidence_strength).toBe('strong')
    expect(insertedSuggestions[1].evidence_strength).toBe('moderate')
    expect(insertedSuggestions[2].evidence_strength).toBe('weak')
  })

  // ── Skip logic ────────────────────────────────────────────────────────────

  it('skips accounts with no recent messages', async () => {
    mockGmMessages = []
    mockTaskMessages = []

    const body = await (await POST(makeRequest('test-cron-secret'))).json()
    expect(body.accountsProcessed).toBe(0)
    expect(mockExtract).not.toHaveBeenCalled()
  })

  it('skips accounts when AI extracts nothing', async () => {
    mockExtract.mockResolvedValue([])

    const body = await (await POST(makeRequest('test-cron-secret'))).json()
    expect(body.totalExtracted).toBe(0)
    expect(insertedSuggestions).toHaveLength(0)
  })

  it('dedupes against existing pending suggestions by content', async () => {
    mockExistingSuggestions = [
      { proposed_change: { content: 'Always sign off as Coach Mike' } },
    ]

    const body = await (await POST(makeRequest('test-cron-secret'))).json()
    expect(body.totalExtracted).toBe(0)
    expect(insertedSuggestions).toHaveLength(0)
  })

  it('dedupes by mergedContent when candidate has targetMemoryId', async () => {
    const mergedContent = 'Sign emails as Coach Mike and use a warm tone'
    mockConsolidate.mockResolvedValue([
      makeMemoryCandidate({ targetMemoryId: 'mem-001', mergedContent }),
    ])
    mockExistingSuggestions = [{ proposed_change: { content: mergedContent } }]

    const body = await (await POST(makeRequest('test-cron-secret'))).json()
    expect(body.totalExtracted).toBe(0)
  })

  it('inserts new suggestion if content differs from existing', async () => {
    mockExistingSuggestions = [{ proposed_change: { content: 'Some other memory' } }]

    const body = await (await POST(makeRequest('test-cron-secret'))).json()
    expect(body.totalExtracted).toBe(1)
    expect(insertedSuggestions).toHaveLength(1)
  })
})
