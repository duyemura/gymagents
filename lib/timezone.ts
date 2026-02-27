/**
 * timezone.ts
 *
 * Timezone utilities for account-aware time calculations.
 * Every account stores an IANA timezone (e.g. 'America/Chicago').
 * These helpers convert between UTC and account-local time so cron jobs,
 * analysis windows, and message scheduling respect the gym's clock.
 *
 * Falls back to 'America/New_York' (Eastern) when no timezone is set.
 */

import { supabaseAdmin } from './supabase'

// ── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_TIMEZONE = 'America/New_York'

/** Quiet hours — don't send messages before 8am or after 9pm local time */
export const QUIET_HOUR_START = 21 // 9pm
export const QUIET_HOUR_END = 8   // 8am

// ── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Get the IANA timezone for an account. Falls back to DEFAULT_TIMEZONE.
 */
export async function getAccountTimezone(accountId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('accounts')
    .select('timezone')
    .eq('id', accountId)
    .single()

  return data?.timezone || DEFAULT_TIMEZONE
}

/**
 * Convert a UTC Date to the account's local time as a formatted string.
 * Returns an object with common date parts for flexibility.
 */
export function toAccountLocalTime(
  utcDate: Date,
  timezone: string,
): { date: Date; hour: number; dayOfWeek: number; isoDate: string; formatted: string } {
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE

  // Get the local time parts using Intl
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = Object.fromEntries(
    formatter.formatToParts(utcDate).map(p => [p.type, p.value]),
  )

  const localYear = parseInt(parts.year)
  const localMonth = parseInt(parts.month) - 1
  const localDay = parseInt(parts.day)
  const localHour = parseInt(parts.hour === '24' ? '0' : parts.hour)
  const localMinute = parseInt(parts.minute)
  const localSecond = parseInt(parts.second)

  // Build a Date that represents the local wall-clock time
  // (Note: this Date object will be in the system's local timezone,
  //  but the numeric values represent the account's local time)
  const localDate = new Date(localYear, localMonth, localDay, localHour, localMinute, localSecond)

  // Day of week in account's timezone
  const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
  const dayName = dayFormatter.format(utcDate)
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const dayOfWeek = dayMap[dayName] ?? localDate.getDay()

  // ISO date string in local time (YYYY-MM-DD)
  const isoDate = `${localYear}-${String(localMonth + 1).padStart(2, '0')}-${String(localDay).padStart(2, '0')}`

  // Human-readable formatted time
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return {
    date: localDate,
    hour: localHour,
    dayOfWeek,
    isoDate,
    formatted: timeFormatter.format(utcDate),
  }
}

/**
 * Get "today" at midnight in the account's timezone, as a UTC Date.
 * Useful for "last 30 days" windows that should align with local midnight.
 *
 * Strategy: Use a binary-search-like approach via Intl.DateTimeFormat.
 * 1. Get today's date in the target timezone
 * 2. Calculate UTC offset by comparing how `now` renders in UTC vs target tz
 * 3. Construct midnight + offset
 */
export function getLocalMidnightAsUTC(timezone: string, now = new Date()): Date {
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE

  // Get the local date in the target timezone
  const local = toAccountLocalTime(now, tz)

  // Calculate offset: how far behind UTC is this timezone?
  // Compare the same instant formatted in UTC vs the target timezone.
  // Both formatted as en-US to get consistent parsing.
  const utcFormatted = now.toLocaleString('en-US', { timeZone: 'UTC' })
  const localFormatted = now.toLocaleString('en-US', { timeZone: tz })

  // Parse both as dates (interpreted in system timezone, but the DIFFERENCE is what matters)
  const utcMs = new Date(utcFormatted).getTime()
  const localMs = new Date(localFormatted).getTime()
  const offsetMs = utcMs - localMs // positive for west-of-UTC timezones

  // Midnight in the target timezone = midnight (as UTC) + offset
  // local.isoDate is e.g. '2026-02-26', so midnight is '2026-02-26T00:00:00Z'
  const midnightAsUTC = new Date(`${local.isoDate}T00:00:00Z`)
  return new Date(midnightAsUTC.getTime() + offsetMs)
}

/**
 * Get the start of "N days ago" in the account's timezone, returned as UTC.
 * e.g. getDaysAgoInTimezone('America/Chicago', 30) = midnight 30 days ago Central time, as UTC.
 */
export function getDaysAgoInTimezone(timezone: string, days: number, now = new Date()): Date {
  const todayMidnightUTC = getLocalMidnightAsUTC(timezone, now)
  return new Date(todayMidnightUTC.getTime() - days * 24 * 60 * 60 * 1000)
}

/**
 * Check if it's currently within quiet hours in the account's timezone.
 * Quiet hours: 9pm - 8am local time (configurable via constants).
 */
export function isQuietHours(timezone: string, now = new Date()): boolean {
  const local = toAccountLocalTime(now, timezone)
  return local.hour >= QUIET_HOUR_START || local.hour < QUIET_HOUR_END
}

/**
 * Get the current local hour in the account's timezone.
 */
export function getLocalHour(timezone: string, now = new Date()): number {
  return toAccountLocalTime(now, timezone).hour
}

/**
 * Get the current day of week (0=Sun, 1=Mon, ...) in the account's timezone.
 */
export function getLocalDayOfWeek(timezone: string, now = new Date()): number {
  return toAccountLocalTime(now, timezone).dayOfWeek
}

/**
 * Check if an IANA timezone string is valid.
 */
export function isValidTimezone(tz: string): boolean {
  if (!tz) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * Get "today" as YYYY-MM-DD in the account's timezone.
 */
export function getTodayInTimezone(timezone: string, now = new Date()): string {
  return toAccountLocalTime(now, timezone).isoDate
}

/**
 * Format a UTC date for display in the account's timezone.
 * e.g. "Feb 26, 2026 at 3:45 PM"
 */
export function formatForDisplay(
  utcDate: Date | string,
  timezone: string,
): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE

  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

/**
 * Get "start of today" in the account's timezone as an ISO string.
 * Useful for DB queries like "tasks created today".
 */
export function getLocalTodayStartISO(timezone: string, now = new Date()): string {
  return getLocalMidnightAsUTC(timezone, now).toISOString()
}
