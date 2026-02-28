/**
 * memories-api.test.ts
 *
 * Tests for the /api/memories API routes (GET, POST, PATCH, DELETE).
 * Validates auth, input validation, account scoping, and CRUD operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockSessionRef,
  mockAccountRef,
  mockGetAccountMemories,
  mockCreateMemory,
  mockUpdateMemory,
} = vi.hoisted(() => ({
  mockSessionRef: { current: null as any },
  mockAccountRef: { current: null as any },
  mockGetAccountMemories: vi.fn().mockResolvedValue([]),
  mockCreateMemory: vi.fn().mockResolvedValue({ id: 'mem-001', content: 'Test', category: 'preference', importance: 3 }),
  mockUpdateMemory: vi.fn().mockResolvedValue({ id: 'mem-001', content: 'Updated' }),
}))

// ── Mock auth ───────────────────────────────────────────────────────────────
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(() => mockSessionRef.current),
}))

// ── Mock db/accounts ────────────────────────────────────────────────────────
vi.mock('@/lib/db/accounts', () => ({
  getAccountForUser: vi.fn(() => mockAccountRef.current),
}))

// ── Mock db/memories ────────────────────────────────────────────────────────
vi.mock('@/lib/db/memories', () => ({
  getAccountMemories: mockGetAccountMemories,
  createMemory: mockCreateMemory,
  updateMemory: mockUpdateMemory,
}))

// ── Mock supabase (for DELETE ownership check) ──────────────────────────────
const mockSupabaseFrom = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (...args: any[]) => mockSupabaseFrom(...args) },
}))

function makeSupabaseChain(result: { data: any; error: any }) {
  const chain: any = {}
  const methods = ['select', 'update', 'eq', 'single']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.single.mockResolvedValue(result)
  return chain
}

// ── Import after mocks ──────────────────────────────────────────────────────
import { GET, POST, PATCH, DELETE } from '../../app/api/memories/route'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(method: string, body?: Record<string, unknown>, params?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/memories')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

const DEFAULT_ACCOUNT = { id: 'acct-001', gym_name: 'Test Gym' }

// ── Tests ───────────────────────────────────────────────────────────────────

describe('/api/memories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionRef.current = { id: 'user-001', email: 'owner@gym.com' }
    mockAccountRef.current = DEFAULT_ACCOUNT
    mockGetAccountMemories.mockResolvedValue([])
    mockCreateMemory.mockResolvedValue({ id: 'mem-001', content: 'Test', category: 'preference', importance: 3 })
    mockUpdateMemory.mockResolvedValue({ id: 'mem-001', content: 'Updated' })
  })

  // ── Auth ──────────────────────────────────────────────────────────────────

  it('GET returns 401 when not authenticated', async () => {
    mockSessionRef.current = null
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(401)
  })

  it('POST returns 401 when not authenticated', async () => {
    mockSessionRef.current = null
    const res = await POST(makeRequest('POST', { content: 'x', category: 'preference' }))
    expect(res.status).toBe(401)
  })

  it('PATCH returns 401 when not authenticated', async () => {
    mockSessionRef.current = null
    const res = await PATCH(makeRequest('PATCH', { id: 'mem-001', content: 'x' }))
    expect(res.status).toBe(401)
  })

  it('DELETE returns 401 when not authenticated', async () => {
    mockSessionRef.current = null
    const res = await DELETE(makeRequest('DELETE', { id: 'mem-001' }))
    expect(res.status).toBe(401)
  })

  // ── No account ────────────────────────────────────────────────────────────

  it('GET returns 400 when no account connected', async () => {
    mockAccountRef.current = null
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(400)
  })

  // ── GET ───────────────────────────────────────────────────────────────────

  it('GET returns memories for account', async () => {
    const memories = [
      { id: 'mem-1', content: 'Use casual tone', category: 'preference', importance: 5 },
    ]
    mockGetAccountMemories.mockResolvedValue(memories)

    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.memories).toEqual(memories)
    expect(mockGetAccountMemories).toHaveBeenCalledWith('acct-001', { category: undefined, memberId: undefined })
  })

  it('GET passes category filter', async () => {
    await GET(makeRequest('GET', undefined, { category: 'preference' }))
    expect(mockGetAccountMemories).toHaveBeenCalledWith('acct-001', { category: 'preference', memberId: undefined })
  })

  // ── POST (create) ────────────────────────────────────────────────────────

  it('POST creates a memory and returns 201', async () => {
    const res = await POST(makeRequest('POST', { content: 'Sign off as Coach Mike', category: 'preference' }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.memory).toBeTruthy()
    expect(mockCreateMemory).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 'acct-001',
      content: 'Sign off as Coach Mike',
      category: 'preference',
      source: 'owner',
    }))
  })

  it('POST returns 400 when content is empty', async () => {
    const res = await POST(makeRequest('POST', { content: '', category: 'preference' }))
    expect(res.status).toBe(400)
  })

  it('POST returns 400 when category is missing', async () => {
    const res = await POST(makeRequest('POST', { content: 'Test' }))
    expect(res.status).toBe(400)
  })

  it('POST returns 400 when importance is out of range', async () => {
    const res = await POST(makeRequest('POST', { content: 'Test', category: 'preference', importance: 6 }))
    expect(res.status).toBe(400)
  })

  // ── PATCH (edit) ─────────────────────────────────────────────────────────

  it('PATCH updates a memory and returns updated data', async () => {
    const chain = makeSupabaseChain({ data: { id: 'mem-001', account_id: 'acct-001' }, error: null })
    mockSupabaseFrom.mockReturnValue(chain)

    const res = await PATCH(makeRequest('PATCH', { id: 'mem-001', content: 'Updated content', importance: 4 }))

    expect(res.status).toBe(200)
    expect(mockUpdateMemory).toHaveBeenCalledWith('mem-001', { content: 'Updated content', importance: 4 })
  })

  it('PATCH returns 400 when id is missing', async () => {
    const res = await PATCH(makeRequest('PATCH', { content: 'Updated' }))
    expect(res.status).toBe(400)
  })

  it('PATCH returns 400 when no fields to update', async () => {
    const chain = makeSupabaseChain({ data: { id: 'mem-001', account_id: 'acct-001' }, error: null })
    mockSupabaseFrom.mockReturnValue(chain)

    const res = await PATCH(makeRequest('PATCH', { id: 'mem-001' }))
    expect(res.status).toBe(400)
  })

  it('PATCH returns 404 when memory belongs to another account', async () => {
    const chain = makeSupabaseChain({ data: { id: 'mem-001', account_id: 'other-account' }, error: null })
    mockSupabaseFrom.mockReturnValue(chain)

    const res = await PATCH(makeRequest('PATCH', { id: 'mem-001', content: 'hack' }))
    expect(res.status).toBe(404)
  })

  it('PATCH returns 400 when importance is invalid', async () => {
    const chain = makeSupabaseChain({ data: { id: 'mem-001', account_id: 'acct-001' }, error: null })
    mockSupabaseFrom.mockReturnValue(chain)

    const res = await PATCH(makeRequest('PATCH', { id: 'mem-001', importance: 0 }))
    expect(res.status).toBe(400)
  })

  // ── DELETE ────────────────────────────────────────────────────────────────

  it('DELETE soft-deletes a memory', async () => {
    const selectChain = makeSupabaseChain({ data: { id: 'mem-001', account_id: 'acct-001' }, error: null })
    const updateChain = makeSupabaseChain({ data: null, error: null })

    let callCount = 0
    mockSupabaseFrom.mockImplementation(() => {
      callCount++
      return callCount === 1 ? selectChain : updateChain
    })

    const res = await DELETE(makeRequest('DELETE', { id: 'mem-001' }))
    expect(res.status).toBe(200)
  })

  it('DELETE returns 404 when memory belongs to another account', async () => {
    const chain = makeSupabaseChain({ data: { id: 'mem-001', account_id: 'other-account' }, error: null })
    mockSupabaseFrom.mockReturnValue(chain)

    const res = await DELETE(makeRequest('DELETE', { id: 'mem-001' }))
    expect(res.status).toBe(404)
  })

  it('DELETE returns 400 when id is missing', async () => {
    const res = await DELETE(makeRequest('DELETE', {}))
    expect(res.status).toBe(400)
  })

  // ── Demo mode ─────────────────────────────────────────────────────────────

  it('GET returns empty memories in demo mode', async () => {
    mockSessionRef.current = { id: 'demo-user', isDemo: true }
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.memories).toEqual([])
  })

  it('POST returns 403 in demo mode', async () => {
    mockSessionRef.current = { id: 'demo-user', isDemo: true }
    const res = await POST(makeRequest('POST', { content: 'Test', category: 'preference' }))
    expect(res.status).toBe(403)
  })

  it('PATCH returns 403 in demo mode', async () => {
    mockSessionRef.current = { id: 'demo-user', isDemo: true }
    const res = await PATCH(makeRequest('PATCH', { id: 'mem-001', content: 'x' }))
    expect(res.status).toBe(403)
  })
})
