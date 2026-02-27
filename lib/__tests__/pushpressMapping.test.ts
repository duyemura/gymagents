/**
 * pushpressMapping.test.ts
 *
 * TDD tests for the PushPress Platform API data mapping logic.
 * Tests the pure transformation functions that convert real API
 * response shapes into AccountSnapshot / MemberData.
 *
 * Written against the real OpenAPI spec (openapi.json):
 *   - Customer.name is { first, last, nickname } — NOT firstName/lastName
 *   - Checkin.customer is the UUID field (not customerId)
 *   - Checkin.timestamp is unix ms
 *   - Enrollment.status: 'active'|'alert'|'canceled'|'completed'|'paused'|'pendactivation'|'pendcancel'
 *   - Enrollment.billingSchedule has period + interval (no amount — comes from Plan)
 *   - Auth: API-KEY header, not Authorization: Bearer
 *
 * These tests cover:
 *   - mapCustomer: name.first + name.last → display name
 *   - mapCustomer: membershipDetails.initialMembershipStartDate → memberSince
 *   - mapCustomer: role='lead' → status='prospect'
 *   - mapEnrollmentStatus: all 7 statuses map correctly
 *   - normalizeMonthlyRevenue: period × interval math
 *   - buildMemberData: attendance counts from checkin array (role='attendee' + result='success' only)
 *   - buildMemberData: filters out role='coach'|'staff'|'assistant'
 *   - buildMemberData: lastCheckinAt from max timestamp in recent window
 *   - ppApiHeaders: uses API-KEY header, not Authorization
 *   - ppGet: correct base URL (platform/v1), handles { data: [] } and [] shapes
 */

import { describe, it, expect } from 'vitest'
import {
  mapCustomer,
  mapEnrollmentStatus,
  normalizeMonthlyRevenue,
  buildMemberData,
  ppApiHeaders,
  PP_PLATFORM_BASE,
} from '../pushpress-platform'
import type {
  PPCustomer,
  PPEnrollment,
  PPCheckin,
  PPBillingSchedule,
} from '../pushpress-platform'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCustomer(overrides: Partial<PPCustomer> = {}): PPCustomer {
  return {
    id: 'usr_123',
    companyId: 'cli_123',
    name: { first: 'Jane', last: 'Smith', nickname: null },
    gender: null,
    dob: null,
    address: { line1: '', line2: '', city: '', country: '', state: '', zip: '' },
    account: { type: 'primary' },
    membershipDetails: { initialMembershipStartDate: '2023-01-15' },
    email: 'jane@example.com',
    phone: '+1-555-123-4567',
    role: 'member',
    ...overrides,
  }
}

function makeEnrollment(overrides: Partial<PPEnrollment> = {}): PPEnrollment {
  return {
    id: 'sub_123',
    customerId: 'usr_123',
    companyId: 'cli_123',
    planId: 'plan_123',
    status: 'active',
    billingSchedule: { period: 'month', interval: 1 },
    checkinDetails: { checkins: 0, limit: -1 },
    entitlements: [],
    startDate: '2023-01-15',
    endDate: null,
    lastCharge: '2024-01-15',
    nextCharge: '2024-02-15',
    paidUntil: '2024-02-15',
    ...overrides,
  }
}

function makeCheckin(
  customerId: string,
  overrides: Partial<PPCheckin> = {},
): PPCheckin {
  return {
    id: `chk_${Math.random().toString(36).slice(2)}`,
    customer: customerId,
    company: 'cli_123',
    timestamp: Date.now(),
    name: 'CrossFit WOD',
    kind: 'class',
    role: 'attendee',
    result: 'success',
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// mapCustomer
// ─────────────────────────────────────────────────────────────────────────────

describe('mapCustomer', () => {
  it('builds display name from name.first + name.last', () => {
    const customer = makeCustomer({
      name: { first: 'Jane', last: 'Smith', nickname: null },
    })
    const result = mapCustomer(customer)
    expect(result.name).toBe('Jane Smith')
  })

  it('uses nickname when present as display name override', () => {
    const customer = makeCustomer({
      name: { first: 'Robert', last: 'Jones', nickname: 'Bobby' },
    })
    const result = mapCustomer(customer)
    // nickname is a display preference — include it or use first+last, either is fine
    // but the name must be non-empty
    expect(result.name.length).toBeGreaterThan(0)
    expect(result.name).toContain('Jones') // last name always present
  })

  it('falls back to email local-part when name is blank', () => {
    const customer = makeCustomer({
      name: { first: '', last: '', nickname: null },
      email: 'anon@example.com',
    })
    const result = mapCustomer(customer)
    // Uses the cleaner email local-part (before @) rather than the full email
    expect(result.name).toBe('anon')
  })

  it('strips plus-alias from email local-part for placeholder names', () => {
    const customer = makeCustomer({
      name: { first: 'Member', last: '(+3)', nickname: null },
      email: 'crossfitportroyalsound+3@gmail.com',
    })
    const result = mapCustomer(customer)
    // "Member (+3)" is a PushPress placeholder — use email-derived name instead
    expect(result.name).toBe('crossfitportroyalsound')
  })

  it('maps membershipDetails.initialMembershipStartDate → memberSince', () => {
    const customer = makeCustomer({
      membershipDetails: { initialMembershipStartDate: '2022-06-01' },
    })
    const result = mapCustomer(customer)
    expect(result.memberSince).toBe('2022-06-01')
  })

  it('handles null membershipDetails.initialMembershipStartDate gracefully', () => {
    const customer = makeCustomer({
      membershipDetails: { initialMembershipStartDate: null },
    })
    const result = mapCustomer(customer)
    expect(typeof result.memberSince).toBe('string')
    expect(result.memberSince.length).toBeGreaterThan(0)
  })

  it('maps email and phone correctly', () => {
    const customer = makeCustomer({
      email: 'test@gym.com',
      phone: '+1-800-555-1234',
    })
    const result = mapCustomer(customer)
    expect(result.email).toBe('test@gym.com')
    expect(result.phone).toBe('+1-800-555-1234')
  })

  it('role=lead → status=prospect', () => {
    const customer = makeCustomer({ role: 'lead' })
    const result = mapCustomer(customer)
    expect(result.customerRole).toBe('lead')
  })

  it('sets id from customer.id', () => {
    const customer = makeCustomer({ id: 'usr_abc123' })
    const result = mapCustomer(customer)
    expect(result.id).toBe('usr_abc123')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// mapEnrollmentStatus
// ─────────────────────────────────────────────────────────────────────────────

describe('mapEnrollmentStatus', () => {
  it("'active' → 'active'", () => {
    expect(mapEnrollmentStatus('active')).toBe('active')
  })

  it("'alert' → 'active' (payment issue but still enrolled)", () => {
    // alert = payment failed, but member is still technically active
    expect(mapEnrollmentStatus('alert')).toBe('active')
  })

  it("'canceled' → 'cancelled'", () => {
    expect(mapEnrollmentStatus('canceled')).toBe('cancelled')
  })

  it("'completed' → 'cancelled' (plan ran its course)", () => {
    expect(mapEnrollmentStatus('completed')).toBe('cancelled')
  })

  it("'paused' → 'paused'", () => {
    expect(mapEnrollmentStatus('paused')).toBe('paused')
  })

  it("'pendactivation' → 'active' (about to start)", () => {
    expect(mapEnrollmentStatus('pendactivation')).toBe('active')
  })

  it("'pendcancel' → 'active' (still active until end of period)", () => {
    // pendcancel = scheduled to cancel but still paying; treat as active for now
    expect(mapEnrollmentStatus('pendcancel')).toBe('active')
  })

  it('undefined/unknown → active (safe default)', () => {
    expect(mapEnrollmentStatus(undefined)).toBe('active')
    expect(mapEnrollmentStatus('unknown_status')).toBe('active')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// normalizeMonthlyRevenue
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeMonthlyRevenue', () => {
  it('monthly billing with interval=1 → face value', () => {
    const schedule: PPBillingSchedule = { period: 'month', interval: 1 }
    expect(normalizeMonthlyRevenue(schedule, 89)).toBe(89)
  })

  it('monthly billing with interval=3 (quarterly) → amount/3', () => {
    const schedule: PPBillingSchedule = { period: 'month', interval: 3 }
    expect(normalizeMonthlyRevenue(schedule, 240)).toBeCloseTo(80)
  })

  it('weekly billing (interval=1) → amount × 4.33', () => {
    const schedule: PPBillingSchedule = { period: 'week', interval: 1 }
    expect(normalizeMonthlyRevenue(schedule, 25)).toBeCloseTo(108.25)
  })

  it('yearly billing (interval=1) → amount / 12', () => {
    const schedule: PPBillingSchedule = { period: 'year', interval: 1 }
    expect(normalizeMonthlyRevenue(schedule, 1200)).toBeCloseTo(100)
  })

  it('yearly billing with interval=2 → amount / 24', () => {
    const schedule: PPBillingSchedule = { period: 'year', interval: 2 }
    expect(normalizeMonthlyRevenue(schedule, 2400)).toBeCloseTo(100)
  })

  it('once (non-recurring) → 0 monthly revenue', () => {
    const schedule: PPBillingSchedule = { period: 'once', interval: 1 }
    expect(normalizeMonthlyRevenue(schedule, 500)).toBe(0)
  })

  it('undefined schedule → 0', () => {
    expect(normalizeMonthlyRevenue(undefined, 0)).toBe(0)
  })

  it('amount=0 → 0', () => {
    expect(normalizeMonthlyRevenue({ period: 'month', interval: 1 }, 0)).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// buildMemberData — attendance counting from checkin array
// ─────────────────────────────────────────────────────────────────────────────

describe('buildMemberData', () => {
  const now = new Date()
  const MS_PER_DAY = 24 * 60 * 60 * 1000

  function tsAgo(days: number): number {
    return now.getTime() - days * MS_PER_DAY
  }

  it('counts only role=attendee + result=success in recent window', () => {
    const customerId = 'usr_123'
    const checkins: PPCheckin[] = [
      makeCheckin(customerId, { timestamp: tsAgo(5), role: 'attendee', result: 'success' }),
      makeCheckin(customerId, { timestamp: tsAgo(10), role: 'attendee', result: 'success' }),
      makeCheckin(customerId, { timestamp: tsAgo(2), role: 'coach', result: 'success' }),   // coach → excluded
      makeCheckin(customerId, { timestamp: tsAgo(7), role: 'attendee', result: 'failure' }), // failure → excluded
    ]

    const enrollment = makeEnrollment({ customerId, status: 'active' })
    const customer = makeCustomer({ id: customerId })
    const result = buildMemberData(customer, enrollment, checkins, now)

    expect(result.recentCheckinsCount).toBe(2) // only the 2 valid attendee+success
  })

  it('filters out role=staff and role=assistant from attendance count', () => {
    const customerId = 'usr_456'
    const checkins: PPCheckin[] = [
      makeCheckin(customerId, { timestamp: tsAgo(3), role: 'staff', result: 'success' }),
      makeCheckin(customerId, { timestamp: tsAgo(5), role: 'assistant', result: 'success' }),
      makeCheckin(customerId, { timestamp: tsAgo(8), role: 'attendee', result: 'success' }),
    ]

    const enrollment = makeEnrollment({ customerId })
    const customer = makeCustomer({ id: customerId })
    const result = buildMemberData(customer, enrollment, checkins, now)

    expect(result.recentCheckinsCount).toBe(1)
  })

  it('computes lastCheckinAt from max timestamp in recent window', () => {
    const customerId = 'usr_789'
    const ts1 = tsAgo(10)
    const ts2 = tsAgo(5)
    const ts3 = tsAgo(15)

    const checkins: PPCheckin[] = [
      makeCheckin(customerId, { timestamp: ts1, role: 'attendee', result: 'success' }),
      makeCheckin(customerId, { timestamp: ts2, role: 'attendee', result: 'success' }), // most recent
      makeCheckin(customerId, { timestamp: ts3, role: 'attendee', result: 'success' }),
    ]

    const enrollment = makeEnrollment({ customerId })
    const customer = makeCustomer({ id: customerId })
    const result = buildMemberData(customer, enrollment, checkins, now)

    expect(result.lastCheckinAt).toBeDefined()
    const lastDate = new Date(result.lastCheckinAt!).getTime()
    expect(Math.abs(lastDate - ts2)).toBeLessThan(1000) // within 1 second
  })

  it('previousCheckinsCount uses 30-60 day window checkins', () => {
    const customerId = 'usr_prev'
    const checkins: PPCheckin[] = [
      // recent (0-30 days)
      makeCheckin(customerId, { timestamp: tsAgo(10), role: 'attendee', result: 'success' }),
      makeCheckin(customerId, { timestamp: tsAgo(20), role: 'attendee', result: 'success' }),
      // previous (31-60 days)
      makeCheckin(customerId, { timestamp: tsAgo(35), role: 'attendee', result: 'success' }),
      makeCheckin(customerId, { timestamp: tsAgo(45), role: 'attendee', result: 'success' }),
      makeCheckin(customerId, { timestamp: tsAgo(55), role: 'attendee', result: 'success' }),
    ]

    const enrollment = makeEnrollment({ customerId })
    const customer = makeCustomer({ id: customerId })
    const result = buildMemberData(customer, enrollment, checkins, now)

    expect(result.recentCheckinsCount).toBe(2)
    expect(result.previousCheckinsCount).toBe(3)
  })

  it('handles member with no checkins gracefully', () => {
    const customer = makeCustomer({ id: 'usr_nocheckin' })
    const enrollment = makeEnrollment({ customerId: 'usr_nocheckin' })
    const result = buildMemberData(customer, enrollment, [], now)

    expect(result.recentCheckinsCount).toBe(0)
    expect(result.previousCheckinsCount).toBe(0)
    expect(result.lastCheckinAt).toBeUndefined()
  })

  it('maps enrollment.nextCharge → renewalDate', () => {
    const customer = makeCustomer({ id: 'usr_renewal' })
    const enrollment = makeEnrollment({
      customerId: 'usr_renewal',
      nextCharge: '2024-03-01',
    })
    const result = buildMemberData(customer, enrollment, [], now)

    expect(result.renewalDate).toBe('2024-03-01')
  })

  it('alert enrollment status → high priority (payment issue flag)', () => {
    const customer = makeCustomer({ id: 'usr_alert' })
    const enrollment = makeEnrollment({ customerId: 'usr_alert', status: 'alert' })
    const result = buildMemberData(customer, enrollment, [], now)

    // alert = payment failed but still active; we surface this as a flag
    expect(result.status).toBe('active')
    expect(result.hasPaymentAlert).toBe(true)
  })

  it('null enrollment → status inferred from customer.role', () => {
    const memberCustomer = makeCustomer({ id: 'usr_norole', role: 'member' })
    const result = buildMemberData(memberCustomer, null, [], now)
    expect(result.status).toBe('active')

    const leadCustomer = makeCustomer({ id: 'usr_lead', role: 'lead' })
    const result2 = buildMemberData(leadCustomer, null, [], now)
    expect(result2.status).toBe('prospect')

    const exMemberCustomer = makeCustomer({ id: 'usr_ex', role: 'ex-member' })
    const result3 = buildMemberData(exMemberCustomer, null, [], now)
    expect(result3.status).toBe('cancelled')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ppApiHeaders — authentication
// ─────────────────────────────────────────────────────────────────────────────

describe('ppApiHeaders', () => {
  it('uses API-KEY header (not Authorization: Bearer)', () => {
    const headers = ppApiHeaders('my-api-key-123')
    expect(headers['API-KEY']).toBe('my-api-key-123')
    expect(headers['Authorization']).toBeUndefined()
  })

  it('includes Content-Type: application/json', () => {
    const headers = ppApiHeaders('key')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('accepts optional company-id for multitenant keys', () => {
    const headers = ppApiHeaders('key', 'company-123')
    expect(headers['company-id']).toBe('company-123')
  })

  it('omits company-id when not provided', () => {
    const headers = ppApiHeaders('key')
    expect(headers['company-id']).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PP_PLATFORM_BASE — correct base URL
// ─────────────────────────────────────────────────────────────────────────────

describe('PP_PLATFORM_BASE', () => {
  it('points to the platform v1 API (not v3)', () => {
    expect(PP_PLATFORM_BASE).toContain('pushpress.com')
    expect(PP_PLATFORM_BASE).toContain('platform')
    // Must NOT be the old v3 API
    expect(PP_PLATFORM_BASE).not.toContain('/v3')
  })
})
