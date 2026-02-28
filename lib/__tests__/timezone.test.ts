/**
 * timezone.test.ts
 *
 * TDD tests for the timezone utility module.
 * Validates timezone conversions, quiet hours, local midnight, and helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  toAccountLocalTime,
  getLocalMidnightAsUTC,
  getDaysAgoInTimezone,
  isQuietHours,
  getLocalHour,
  getLocalDayOfWeek,
  isValidTimezone,
  getTodayInTimezone,
  formatForDisplay,
  getLocalTodayStartISO,
  getAccountTimezone,
  DEFAULT_TIMEZONE,
  QUIET_HOUR_START,
  QUIET_HOUR_END,
} from '../timezone'

// ── Mock supabase for getAccountTimezone ──────────────────────────────────

const mockSingle = vi.fn()
const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })

vi.mock('../supabase', () => ({
  supabaseAdmin: {
    from: (...args: any[]) => mockFrom(...args),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReturnValue({ select: mockSelect })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockEq.mockReturnValue({ single: mockSingle })
})

// ── isValidTimezone ──────────────────────────────────────────────────────

describe('isValidTimezone', () => {
  it('returns true for valid IANA timezones', () => {
    expect(isValidTimezone('America/Chicago')).toBe(true)
    expect(isValidTimezone('America/New_York')).toBe(true)
    expect(isValidTimezone('America/Los_Angeles')).toBe(true)
    expect(isValidTimezone('Europe/London')).toBe(true)
    expect(isValidTimezone('UTC')).toBe(true)
  })

  it('returns false for invalid timezone strings', () => {
    expect(isValidTimezone('')).toBe(false)
    expect(isValidTimezone('NotATimezone')).toBe(false)
    expect(isValidTimezone('US/FakeZone')).toBe(false)
  })
})

// ── toAccountLocalTime ───────────────────────────────────────────────────

describe('toAccountLocalTime', () => {
  it('converts UTC noon to Central time (UTC-6 in winter)', () => {
    // Feb 26, 2026 12:00 UTC → 6:00 AM Central (CST is UTC-6)
    const utc = new Date('2026-02-26T12:00:00Z')
    const local = toAccountLocalTime(utc, 'America/Chicago')
    expect(local.hour).toBe(6)
    expect(local.isoDate).toBe('2026-02-26')
  })

  it('converts UTC noon to Eastern time (UTC-5 in winter)', () => {
    // Feb 26, 2026 12:00 UTC → 7:00 AM Eastern (EST is UTC-5)
    const utc = new Date('2026-02-26T12:00:00Z')
    const local = toAccountLocalTime(utc, 'America/New_York')
    expect(local.hour).toBe(7)
    expect(local.isoDate).toBe('2026-02-26')
  })

  it('handles date boundary crossing (UTC midnight → previous day local)', () => {
    // Feb 26, 2026 03:00 UTC → Feb 25 at 9:00 PM Central
    const utc = new Date('2026-02-26T03:00:00Z')
    const local = toAccountLocalTime(utc, 'America/Chicago')
    expect(local.hour).toBe(21) // 9 PM
    expect(local.isoDate).toBe('2026-02-25') // previous day
  })

  it('returns day of week in account timezone', () => {
    // Thursday Feb 26, 2026 at 03:00 UTC → Wednesday in Central
    const utc = new Date('2026-02-26T03:00:00Z')
    const local = toAccountLocalTime(utc, 'America/Chicago')
    // Feb 25, 2026 is a Wednesday
    expect(local.dayOfWeek).toBe(3) // Wednesday
  })

  it('falls back to DEFAULT_TIMEZONE for invalid timezone', () => {
    const utc = new Date('2026-02-26T12:00:00Z')
    const local = toAccountLocalTime(utc, 'Invalid/Zone')
    // Should use Eastern time (default)
    expect(local.hour).toBe(7) // EST
  })

  it('returns formatted time string', () => {
    const utc = new Date('2026-02-26T15:30:00Z')
    const local = toAccountLocalTime(utc, 'America/Chicago')
    expect(local.formatted).toMatch(/9:30\s*AM/)
  })
})

// ── getLocalMidnightAsUTC ────────────────────────────────────────────────

describe('getLocalMidnightAsUTC', () => {
  it('returns UTC equivalent of local midnight for Central time', () => {
    // During CST (UTC-6), midnight Central = 6:00 AM UTC
    const now = new Date('2026-02-26T15:00:00Z')
    const midnight = getLocalMidnightAsUTC('America/Chicago', now)
    expect(midnight.getUTCHours()).toBe(6)
    expect(midnight.getUTCMinutes()).toBe(0)
  })

  it('returns UTC equivalent of local midnight for Eastern time', () => {
    // During EST (UTC-5), midnight Eastern = 5:00 AM UTC
    const now = new Date('2026-02-26T15:00:00Z')
    const midnight = getLocalMidnightAsUTC('America/New_York', now)
    expect(midnight.getUTCHours()).toBe(5)
    expect(midnight.getUTCMinutes()).toBe(0)
  })

  it('returns today\'s midnight, not tomorrow\'s', () => {
    const now = new Date('2026-02-26T15:00:00Z')
    const midnight = getLocalMidnightAsUTC('America/Chicago', now)
    // Should be Feb 26 at midnight Central = Feb 26 06:00 UTC
    expect(midnight.getUTCDate()).toBe(26)
  })
})

// ── getDaysAgoInTimezone ─────────────────────────────────────────────────

describe('getDaysAgoInTimezone', () => {
  it('returns 30 days ago from local midnight', () => {
    const now = new Date('2026-02-26T15:00:00Z')
    const thirtyAgo = getDaysAgoInTimezone('America/Chicago', 30, now)
    // Feb 26 midnight Central minus 30 days = Jan 27 midnight Central
    // Jan 27 midnight CST = Jan 27 06:00 UTC
    expect(thirtyAgo.getUTCMonth()).toBe(0) // January (0-indexed)
    expect(thirtyAgo.getUTCDate()).toBe(27)
    expect(thirtyAgo.getUTCHours()).toBe(6)
  })

  it('returns 0 days ago = today\'s midnight', () => {
    const now = new Date('2026-02-26T15:00:00Z')
    const today = getDaysAgoInTimezone('America/Chicago', 0, now)
    const midnight = getLocalMidnightAsUTC('America/Chicago', now)
    expect(today.getTime()).toBe(midnight.getTime())
  })
})

// ── isQuietHours ─────────────────────────────────────────────────────────

describe('isQuietHours', () => {
  it('returns true during late night (10pm local)', () => {
    // 10 PM Central = 4 AM UTC next day (CST is UTC-6)
    const utc = new Date('2026-02-27T04:00:00Z')
    expect(isQuietHours('America/Chicago', utc)).toBe(true)
  })

  it('returns true during early morning (6am local)', () => {
    // 6 AM Central = 12 PM UTC (CST is UTC-6)
    const utc = new Date('2026-02-26T12:00:00Z')
    expect(isQuietHours('America/Chicago', utc)).toBe(true)
  })

  it('returns false during business hours (10am local)', () => {
    // 10 AM Central = 4 PM UTC (CST is UTC-6)
    const utc = new Date('2026-02-26T16:00:00Z')
    expect(isQuietHours('America/Chicago', utc)).toBe(false)
  })

  it('returns false at exactly 8am (start of allowed hours)', () => {
    // 8 AM Central = 2 PM UTC
    const utc = new Date('2026-02-26T14:00:00Z')
    expect(isQuietHours('America/Chicago', utc)).toBe(false)
  })

  it('returns true at exactly 9pm (start of quiet hours)', () => {
    // 9 PM Central = 3 AM UTC next day
    const utc = new Date('2026-02-27T03:00:00Z')
    expect(isQuietHours('America/Chicago', utc)).toBe(true)
  })
})

// ── getLocalHour ─────────────────────────────────────────────────────────

describe('getLocalHour', () => {
  it('returns correct hour for Central timezone', () => {
    const utc = new Date('2026-02-26T18:00:00Z') // noon Central
    expect(getLocalHour('America/Chicago', utc)).toBe(12)
  })

  it('returns correct hour for Eastern timezone', () => {
    const utc = new Date('2026-02-26T18:00:00Z') // 1 PM Eastern
    expect(getLocalHour('America/New_York', utc)).toBe(13)
  })
})

// ── getLocalDayOfWeek ────────────────────────────────────────────────────

describe('getLocalDayOfWeek', () => {
  it('returns Monday (1) for a Monday in Central time', () => {
    // March 2, 2026 is a Monday
    const utc = new Date('2026-03-02T18:00:00Z')
    expect(getLocalDayOfWeek('America/Chicago', utc)).toBe(1)
  })

  it('handles date boundary (UTC Monday but local Sunday)', () => {
    // March 2, 2026 (Monday) at 3:00 UTC → March 1 (Sunday) in Pacific
    const utc = new Date('2026-03-02T03:00:00Z')
    expect(getLocalDayOfWeek('America/Los_Angeles', utc)).toBe(0) // Sunday
  })
})

// ── getTodayInTimezone ───────────────────────────────────────────────────

describe('getTodayInTimezone', () => {
  it('returns YYYY-MM-DD for account local date', () => {
    const utc = new Date('2026-02-26T18:00:00Z')
    expect(getTodayInTimezone('America/Chicago', utc)).toBe('2026-02-26')
  })

  it('returns previous day when UTC date has crossed but local has not', () => {
    // Feb 27 01:00 UTC → Feb 26 in Central
    const utc = new Date('2026-02-27T01:00:00Z')
    expect(getTodayInTimezone('America/Chicago', utc)).toBe('2026-02-26')
  })
})

// ── formatForDisplay ─────────────────────────────────────────────────────

describe('formatForDisplay', () => {
  it('formats a date with timezone', () => {
    const utc = new Date('2026-02-26T18:30:00Z')
    const formatted = formatForDisplay(utc, 'America/Chicago')
    expect(formatted).toContain('Feb')
    expect(formatted).toContain('26')
    expect(formatted).toContain('2026')
    expect(formatted).toMatch(/12:30\s*PM/)
  })

  it('accepts ISO string input', () => {
    const formatted = formatForDisplay('2026-02-26T18:30:00Z', 'America/Chicago')
    expect(formatted).toContain('Feb')
    expect(formatted).toContain('26')
  })

  it('falls back to default timezone for invalid tz', () => {
    const formatted = formatForDisplay('2026-02-26T18:30:00Z', 'Invalid/Zone')
    // Should still produce a valid formatted string (using Eastern)
    expect(formatted).toContain('Feb')
    expect(formatted).toContain('26')
  })
})

// ── getLocalTodayStartISO ────────────────────────────────────────────────

describe('getLocalTodayStartISO', () => {
  it('returns ISO string of midnight in account timezone', () => {
    const now = new Date('2026-02-26T15:00:00Z')
    const iso = getLocalTodayStartISO('America/Chicago', now)
    // Midnight Central = 06:00 UTC
    expect(iso).toMatch(/2026-02-26T06:00:00/)
  })
})

// ── getAccountTimezone ───────────────────────────────────────────────────

describe('getAccountTimezone', () => {
  it('returns timezone from database', async () => {
    mockSingle.mockResolvedValue({ data: { timezone: 'America/Chicago' } })
    const tz = await getAccountTimezone('acct-001')
    expect(tz).toBe('America/Chicago')
    expect(mockFrom).toHaveBeenCalledWith('accounts')
  })

  it('returns default timezone when account has no timezone set', async () => {
    mockSingle.mockResolvedValue({ data: { timezone: null } })
    const tz = await getAccountTimezone('acct-002')
    expect(tz).toBe(DEFAULT_TIMEZONE)
  })

  it('returns default timezone when query fails', async () => {
    mockSingle.mockResolvedValue({ data: null })
    const tz = await getAccountTimezone('nonexistent')
    expect(tz).toBe(DEFAULT_TIMEZONE)
  })
})

// ── Constants ────────────────────────────────────────────────────────────

describe('constants', () => {
  it('has sensible quiet hours', () => {
    expect(QUIET_HOUR_START).toBe(21) // 9 PM
    expect(QUIET_HOUR_END).toBe(8)    // 8 AM
  })

  it('has a valid default timezone', () => {
    expect(DEFAULT_TIMEZONE).toBe('America/New_York')
    expect(isValidTimezone(DEFAULT_TIMEZONE)).toBe(true)
  })
})
