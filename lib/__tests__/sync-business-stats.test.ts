import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatStatsForMemory, writeStatsFromSnapshot, type BusinessStats } from '../sync-business-stats'

// ── Mock Supabase ────────────────────────────────────────────────────────────

const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()

// Build a chainable query mock that returns { data: [], error: null } at any terminal point
function chainable(terminal: any = { data: [], error: null }): any {
  const proxy: any = new Proxy(() => proxy, {
    get: (_target, prop) => {
      if (prop === 'then') return undefined // not a promise
      if (prop === 'data') return terminal.data
      if (prop === 'error') return terminal.error
      return (..._args: any[]) => proxy
    },
    apply: (_target, _thisArg, _args) => proxy,
  })
  // Spread terminal props so destructuring works
  proxy.data = terminal.data
  proxy.error = terminal.error
  return proxy
}

vi.mock('../supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: (...args: any[]) => {
        mockSelect(...args)
        return chainable({ data: [], error: null })
      },
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
        return {
          eq: () => ({ error: null }),
        }
      },
    }),
  },
}))

// ── Tests: formatStatsForMemory ──────────────────────────────────────────────

describe('formatStatsForMemory', () => {
  const baseStats: BusinessStats = {
    totalMembers: 121,
    active: 98,
    paused: 5,
    cancelled: 12,
    leads: 6,
    newLast30Days: 8,
    cancelledLast30Days: 3,
    avgVisitsPerWeek: 2.3,
    attendanceTrend: 'stable',
    estimatedMRR: 14700,
    syncedAt: '2026-02-26T12:00:00.000Z',
  }

  it('includes total member count with breakdown', () => {
    const result = formatStatsForMemory(baseStats)
    expect(result).toContain('Members: 121 total (98 active, 5 paused, 12 cancelled, 6 leads)')
  })

  it('shows 30-day changes', () => {
    const result = formatStatsForMemory(baseStats)
    expect(result).toContain('Last 30 days: +8 new, -3 cancelled')
  })

  it('shows attendance with trend', () => {
    const result = formatStatsForMemory(baseStats)
    expect(result).toContain('Avg attendance: 2.3 visits/week (trend: stable)')
  })

  it('formats MRR in $k for large amounts', () => {
    const result = formatStatsForMemory(baseStats)
    expect(result).toContain('Estimated MRR: $15k/mo')
  })

  it('formats MRR in dollars for small amounts', () => {
    const result = formatStatsForMemory({ ...baseStats, estimatedMRR: 450 })
    expect(result).toContain('Estimated MRR: $450/mo')
  })

  it('includes sync date', () => {
    const result = formatStatsForMemory(baseStats)
    expect(result).toContain('Last synced: Feb 26, 2026')
  })

  it('omits paused when zero', () => {
    const result = formatStatsForMemory({ ...baseStats, paused: 0 })
    expect(result).toContain('Members: 121 total (98 active, 12 cancelled, 6 leads)')
    expect(result).not.toContain('paused')
  })

  it('omits attendance when no sample', () => {
    const result = formatStatsForMemory({ ...baseStats, avgVisitsPerWeek: null })
    expect(result).not.toContain('attendance')
  })

  it('omits 30-day changes when both zero', () => {
    const result = formatStatsForMemory({ ...baseStats, newLast30Days: 0, cancelledLast30Days: 0 })
    expect(result).not.toContain('Last 30 days')
  })

  it('shows only new when no recent cancellations', () => {
    const result = formatStatsForMemory({ ...baseStats, cancelledLast30Days: 0 })
    expect(result).toContain('Last 30 days: +8 new')
    // The "Last 30 days" line should not mention cancellations
    const last30Line = result.split('\n').find(l => l.startsWith('Last 30 days'))!
    expect(last30Line).not.toContain('cancelled')
  })
})

// ── Tests: writeStatsFromSnapshot ────────────────────────────────────────────

describe('writeStatsFromSnapshot', () => {
  beforeEach(() => {
    mockSelect.mockClear()
    mockInsert.mockClear()
    mockUpdate.mockClear()
  })

  it('creates a memory from snapshot data', async () => {
    const snapshot = {
      members: [
        { status: 'active', memberSince: '2025-01-01', recentCheckinsCount: 8, previousCheckinsCount: 6, monthlyRevenue: 150 },
        { status: 'active', memberSince: '2026-02-15', recentCheckinsCount: 3, previousCheckinsCount: 0, monthlyRevenue: 150 },
        { status: 'cancelled', memberSince: '2024-06-01', recentCheckinsCount: 0, previousCheckinsCount: 0, monthlyRevenue: 0 },
        { status: 'prospect', memberSince: '2026-02-20', recentCheckinsCount: 0, previousCheckinsCount: 0, monthlyRevenue: 0 },
      ],
    }

    const memoryId = await writeStatsFromSnapshot('acct-1', snapshot, 150)
    expect(memoryId).toBe('mem-1')
    expect(mockInsert).toHaveBeenCalled()
    const insertedContent = mockInsert.mock.calls[0][0].content
    expect(insertedContent).toContain('Members: 4 total')
    expect(insertedContent).toContain('2 active')
  })

  it('computes attendance trend from checkin data', async () => {
    const snapshot = {
      members: [
        { status: 'active', memberSince: '2025-01-01', recentCheckinsCount: 4, previousCheckinsCount: 10, monthlyRevenue: 150 },
        { status: 'active', memberSince: '2025-01-01', recentCheckinsCount: 3, previousCheckinsCount: 8, monthlyRevenue: 150 },
      ],
    }

    await writeStatsFromSnapshot('acct-1', snapshot, 150)
    const content = mockInsert.mock.calls[0][0].content
    expect(content).toContain('trend: declining')
  })
})
