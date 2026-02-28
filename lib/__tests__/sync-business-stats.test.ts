import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatStatsForMemory, writeStatsFromSnapshot, type BusinessStats } from '../sync-business-stats'

// Mock timezone module (isValidTimezone is imported by sync-business-stats)
vi.mock('../timezone', () => ({
  isValidTimezone: vi.fn().mockReturnValue(true),
  DEFAULT_TIMEZONE: 'America/New_York',
}))

// ── Mock Supabase ────────────────────────────────────────────────────────────

const mockInsert = vi.fn()
const mockUpdate = vi.fn()

// Chainable query mock — returns { data: [], error: null } at any terminal point
function chainable(terminal: any = { data: [], error: null }): any {
  const proxy: any = new Proxy(() => proxy, {
    get: (_target, prop) => {
      if (prop === 'then') return undefined
      if (prop === 'data') return terminal.data
      if (prop === 'error') return terminal.error
      return (..._args: any[]) => proxy
    },
    apply: (_target, _thisArg, _args) => proxy,
  })
  proxy.data = terminal.data
  proxy.error = terminal.error
  return proxy
}

vi.mock('../supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => chainable({ data: [], error: null }),
      insert: (...args: any[]) => {
        mockInsert(...args)
        return {
          select: () => ({
            single: () => ({
              data: { id: 'mem-1', ...args[0] },
              error: null,
            }),
          }),
        }
      },
      update: (...args: any[]) => {
        mockUpdate(...args)
        return { eq: () => ({ error: null }) }
      },
    }),
  },
}))

// ── Test data ────────────────────────────────────────────────────────────────

const baseStats: BusinessStats = {
  businessInfo: {
    name: 'KS Athletic Club',
    city: 'Kansas City',
    state: 'MO',
    postalCode: '64108',
    country: 'US',
    phone: '(816) 555-1234',
    timezone: 'America/Chicago',
  },
  totalMembers: 103,   // active + paused
  active: 98,
  paused: 5,
  cancelled: 12,
  leads: 6,
  newLast30Days: 8,
  cancelledLast30Days: 3,
  estimatedMRR: 14700,  // 98 * 150
  syncedAt: '2026-02-26T12:00:00.000Z',
}

// ── Tests: formatStatsForMemory ──────────────────────────────────────────────

describe('formatStatsForMemory', () => {
  it('includes location from business info', () => {
    const result = formatStatsForMemory(baseStats)
    expect(result).toContain('Location: Kansas City, MO 64108 US')
  })

  it('includes phone', () => {
    const result = formatStatsForMemory(baseStats)
    expect(result).toContain('Phone: (816) 555-1234')
  })

  it('includes timezone', () => {
    const result = formatStatsForMemory(baseStats)
    expect(result).toContain('Timezone: America/Chicago')
  })

  it('shows active members prominently', () => {
    const result = formatStatsForMemory(baseStats)
    expect(result).toContain('Active members: 98')
    expect(result).toContain('Paused: 5')
    expect(result).toContain('Former members: 12')
    expect(result).toContain('Leads: 6')
  })

  it('shows 30-day changes', () => {
    const result = formatStatsForMemory(baseStats)
    expect(result).toContain('Last 30 days: +8 new, -3 cancelled')
  })

  it('includes estimated MRR', () => {
    const result = formatStatsForMemory(baseStats)
    expect(result).toContain('Estimated MRR: $14.7k/mo')
  })

  it('includes sync date', () => {
    const result = formatStatsForMemory(baseStats)
    expect(result).toContain('Last synced: Feb 26, 2026')
  })

  it('omits paused when zero', () => {
    const result = formatStatsForMemory({ ...baseStats, paused: 0 })
    expect(result).not.toContain('Paused')
    expect(result).toContain('Active members: 98')
  })

  it('omits 30-day changes when both zero', () => {
    const result = formatStatsForMemory({ ...baseStats, newLast30Days: 0, cancelledLast30Days: 0 })
    expect(result).not.toContain('Last 30 days')
  })

  it('omits location when no city/state', () => {
    const result = formatStatsForMemory({ ...baseStats, businessInfo: { name: 'Test' } })
    expect(result).not.toContain('Location')
  })

  it('does not include attendance data (moved to schedule)', () => {
    const result = formatStatsForMemory(baseStats)
    expect(result).not.toContain('Checkins')
    expect(result).not.toContain('visits/week')
    expect(result).not.toContain('Programs')
  })

  it('shows only new when no recent cancellations', () => {
    const result = formatStatsForMemory({ ...baseStats, cancelledLast30Days: 0 })
    const last30Line = result.split('\n').find(l => l.startsWith('Last 30 days'))!
    expect(last30Line).toContain('+8 new')
    expect(last30Line).not.toContain('cancelled')
  })
})

// ── Tests: writeStatsFromSnapshot ────────────────────────────────────────────

describe('writeStatsFromSnapshot', () => {
  beforeEach(() => {
    mockInsert.mockClear()
    mockUpdate.mockClear()
  })

  it('creates a memory from snapshot data', async () => {
    const snapshot = {
      accountName: 'Test Gym',
      members: [
        { status: 'active', memberSince: '2025-01-01' },
        { status: 'active', memberSince: '2026-02-15' },
        { status: 'cancelled', memberSince: '2024-06-01' },
        { status: 'prospect', memberSince: '2026-02-20' },
      ],
    }

    const memoryId = await writeStatsFromSnapshot('acct-1', snapshot, 150)
    expect(memoryId).toBe('mem-1')
    expect(mockInsert).toHaveBeenCalled()
    const content = mockInsert.mock.calls[0][0].content
    expect(content).toContain('Active members: 2')
    expect(content).toContain('Leads: 1')
    expect(content).toContain('Estimated MRR: $300/mo')  // 2 active * $150
  })

  it('counts leads and cancelled separately', async () => {
    const snapshot = {
      accountName: 'Test Gym',
      members: [
        { status: 'active', memberSince: '2025-01-01' },
        { status: 'cancelled', memberSince: '2024-01-01' },
        { status: 'prospect', memberSince: '2026-02-01' },
        { status: 'paused', memberSince: '2025-06-01' },
      ],
    }

    await writeStatsFromSnapshot('acct-1', snapshot, 150)
    const content = mockInsert.mock.calls[0][0].content
    expect(content).toContain('Active members: 1')
    expect(content).toContain('Paused: 1')
    expect(content).toContain('Former members: 1')
    expect(content).toContain('Leads: 1')
  })
})
