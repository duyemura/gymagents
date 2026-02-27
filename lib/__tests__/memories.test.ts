import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing module
const mockFrom = vi.fn()
vi.mock('../supabase', () => ({
  supabaseAdmin: { from: (...args: any[]) => mockFrom(...args) },
}))

import {
  getAccountMemories,
  createMemory,
  updateMemory,
  deactivateMemory,
  getMemoriesForPrompt,
} from '../db/memories'

// Helper to build a chainable query mock
function buildChain(result: { data: any; error: any }) {
  const chain: any = {}
  const methods = ['select', 'insert', 'update', 'eq', 'or', 'gte', 'order', 'single']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  // Terminal calls resolve with result
  chain.single.mockResolvedValue(result)
  // For non-single queries, make the last .order or .eq resolve
  chain.order.mockReturnValue({ ...chain, then: (fn: any) => Promise.resolve(result).then(fn) })
  chain.gte.mockReturnValue({ ...chain, then: (fn: any) => Promise.resolve(result).then(fn) })
  chain.or.mockReturnValue({ ...chain, then: (fn: any) => Promise.resolve(result).then(fn) })
  chain.eq.mockReturnValue({ ...chain, then: (fn: any) => Promise.resolve(result).then(fn) })
  return chain
}

const GYM_ID = 'gym-123'

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================
// getAccountMemories
// ============================================================
describe('getAccountMemories', () => {
  it('returns memories for a gym', async () => {
    const memories = [
      { id: '1', content: 'Use casual tone', category: 'preference', importance: 5 },
      { id: '2', content: 'Peak churn in January', category: 'gym_context', importance: 3 },
    ]
    const chain = buildChain({ data: memories, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await getAccountMemories(GYM_ID)

    expect(mockFrom).toHaveBeenCalledWith('memories')
    expect(chain.eq).toHaveBeenCalledWith('account_id', GYM_ID)
    expect(chain.eq).toHaveBeenCalledWith('active', true)
    expect(result).toEqual(memories)
  })

  it('filters by category when provided', async () => {
    const chain = buildChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await getAccountMemories(GYM_ID, { category: 'preference' })

    expect(chain.eq).toHaveBeenCalledWith('category', 'preference')
  })

  it('filters by minImportance when provided', async () => {
    const chain = buildChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await getAccountMemories(GYM_ID, { minImportance: 4 })

    expect(chain.gte).toHaveBeenCalledWith('importance', 4)
  })

  it('throws on DB error', async () => {
    const chain = buildChain({ data: null, error: { message: 'DB down' } })
    mockFrom.mockReturnValue(chain)

    await expect(getAccountMemories(GYM_ID)).rejects.toThrow('getAccountMemories failed: DB down')
  })
})

// ============================================================
// createMemory
// ============================================================
describe('createMemory', () => {
  it('inserts a memory with defaults', async () => {
    const memory = { id: 'new-1', content: 'Sign off as Coach Mike' }
    const chain = buildChain({ data: memory, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await createMemory({
      accountId: GYM_ID,
      category: 'preference',
      content: 'Sign off as Coach Mike',
      source: 'owner',
    })

    expect(mockFrom).toHaveBeenCalledWith('memories')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: GYM_ID,
        category: 'preference',
        content: 'Sign off as Coach Mike',
        importance: 3,
        scope: 'global',
        member_id: null,
        source: 'owner',
      }),
    )
    expect(result).toEqual(memory)
  })

  it('passes custom importance and scope', async () => {
    const chain = buildChain({ data: { id: 'new-2' }, error: null })
    mockFrom.mockReturnValue(chain)

    await createMemory({
      accountId: GYM_ID,
      category: 'member_fact',
      content: 'Prefers morning classes',
      importance: 4,
      scope: 'retention',
      memberId: 'member-abc',
      source: 'agent',
    })

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        importance: 4,
        scope: 'retention',
        member_id: 'member-abc',
        source: 'agent',
      }),
    )
  })

  it('throws on DB error', async () => {
    const chain = buildChain({ data: null, error: { message: 'unique violation' } })
    mockFrom.mockReturnValue(chain)

    await expect(
      createMemory({ accountId: GYM_ID, category: 'preference', content: 'test', source: 'owner' }),
    ).rejects.toThrow('createMemory failed')
  })
})

// ============================================================
// updateMemory
// ============================================================
describe('updateMemory', () => {
  it('updates content and sets updated_at', async () => {
    const chain = buildChain({ data: null, error: null })
    // For update() which doesn't call .single(), need to resolve from .eq()
    chain.eq.mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    await updateMemory('mem-1', { content: 'Updated content' })

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Updated content' }),
    )
    expect(chain.eq).toHaveBeenCalledWith('id', 'mem-1')
  })

  it('throws on DB error', async () => {
    const chain = buildChain({ data: null, error: null })
    chain.eq.mockResolvedValue({ data: null, error: { message: 'not found' } })
    mockFrom.mockReturnValue(chain)

    await expect(updateMemory('mem-1', { content: 'x' })).rejects.toThrow('updateMemory failed')
  })
})

// ============================================================
// deactivateMemory
// ============================================================
describe('deactivateMemory', () => {
  it('sets active=false', async () => {
    const chain = buildChain({ data: null, error: null })
    chain.eq.mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    await deactivateMemory('mem-1')

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ active: false }),
    )
  })
})

// ============================================================
// getMemoriesForPrompt
// ============================================================
describe('getMemoriesForPrompt', () => {
  it('returns empty string when no memories', async () => {
    const chain = buildChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    const result = await getMemoriesForPrompt(GYM_ID)
    expect(result).toBe('')
  })

  it('formats memories into prompt sections grouped by category', async () => {
    const memories = [
      { id: '1', content: 'Use casual tone', category: 'preference', importance: 5 },
      { id: '2', content: 'Sign off as Coach Mike', category: 'preference', importance: 4 },
      { id: '3', content: 'Peak churn in January', category: 'gym_context', importance: 3 },
    ]
    const chain = buildChain({ data: memories, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await getMemoriesForPrompt(GYM_ID)

    expect(result).toContain('## Gym Context & Memories')
    expect(result).toContain('### Owner Preferences')
    expect(result).toContain('- Use casual tone')
    expect(result).toContain('- Sign off as Coach Mike')
    expect(result).toContain('### Business Profile')
    expect(result).toContain('- Peak churn in January')
  })

  it('passes minImportance=3 to query', async () => {
    const chain = buildChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await getMemoriesForPrompt(GYM_ID)

    expect(chain.gte).toHaveBeenCalledWith('importance', 3)
  })

  it('passes memberId and scope through to query', async () => {
    const chain = buildChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await getMemoriesForPrompt(GYM_ID, { scope: 'retention', memberId: 'member-1' })

    expect(chain.or).toHaveBeenCalledWith('member_id.is.null,member_id.eq.member-1')
    expect(chain.or).toHaveBeenCalledWith('scope.eq.global,scope.eq.retention')
  })
})
