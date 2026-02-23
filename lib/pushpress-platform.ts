/**
 * pushpress-platform.ts
 *
 * PushPress Platform API v1 client — typed against the real OpenAPI spec.
 * https://api.pushpressdev.com/platform/docs/openapi.json
 *
 * Key differences from the old v3 SDK:
 *   - Base URL: https://api.pushpressdev.com/platform/v1
 *   - Auth: API-KEY header (not Authorization: Bearer)
 *   - Customer.name is { first, last, nickname } — nested object
 *   - Checkin.customer is the UUID (not customerId)
 *   - Checkin.timestamp is unix ms
 *   - Enrollment.status enum: active|alert|canceled|completed|paused|pendactivation|pendcancel
 *   - Enrollment.billingSchedule has { period, interval } — no amount field
 *   - Monthly revenue must be supplied separately (from Plan or known price)
 */

import type { MemberData } from './agents/GMAgent'

// ── Constants ─────────────────────────────────────────────────────────────────

export const PP_PLATFORM_BASE = 'https://api.pushpressdev.com/platform/v1'

// ── OpenAPI types (exact field names from spec) ────────────────────────────────

export interface PPCustomerName {
  first: string
  last: string
  nickname: string | null
}

export interface PPCustomerAddress {
  line1: string
  line2: string
  city: string
  country: string
  state: string
  zip: string
}

export interface PPMembershipDetails {
  initialMembershipStartDate: string | null
}

export type PPCustomerRole =
  | 'superuser' | 'admin' | 'coach' | 'frontdesk'
  | 'member' | 'non-member' | 'ex-member' | 'lead'

export interface PPCustomer {
  id: string
  companyId: string
  name: PPCustomerName
  gender: 'male' | 'female' | null
  dob: string | null
  address: PPCustomerAddress
  account: { type: 'linked'; primaryCustomerId: string } | { type: 'primary' }
  membershipDetails: PPMembershipDetails | null
  email: string
  phone?: string | null
  role?: PPCustomerRole | null
  assignedToStaffId?: string | null
  profileImage?: string | null
}

export type PPEnrollmentStatus =
  | 'active'
  | 'alert'          // payment issue — still enrolled
  | 'canceled'
  | 'completed'      // plan ran its full course
  | 'paused'
  | 'pendactivation' // signed up, not yet started
  | 'pendcancel'     // scheduled to cancel, still active

export interface PPBillingSchedule {
  period: 'day' | 'week' | 'month' | 'year' | 'once'
  interval: number   // number of periods between bills (e.g. 3 = quarterly)
}

export interface PPCheckinDetails {
  checkins: number   // checkins used in current period
  limit: number      // -1 = unlimited
}

export interface PPEnrollment {
  id: string
  customerId: string
  companyId: string
  planId?: string | null
  status: PPEnrollmentStatus
  billingSchedule: PPBillingSchedule
  checkinDetails: PPCheckinDetails
  entitlements: unknown[]
  startDate?: string | null
  endDate?: string | null
  lastCharge?: string | null
  nextCharge?: string | null
  paidUntil?: string | null
}

/** Union type for all checkin kinds */
export interface PPCheckin {
  id: string
  customer: string   // UUID — note: field is "customer", NOT "customerId"
  company: string
  timestamp: number  // unix ms
  enrollmentId?: string | null
  name?: string
  kind: 'class' | 'appointment' | 'event' | 'open'
  role?: 'staff' | 'coach' | 'assistant' | 'attendee'
  result?: 'success' | 'failure'
  failureReason?: string | null
  // class-specific
  typeId?: string
  classId?: string
  source?: string
  // appointment-specific
  appointmentId?: string
  staffId?: string
  // event-specific
  eventId?: string
}

// ── Mapped output type ────────────────────────────────────────────────────────

/** Intermediate type from mapCustomer — raw customer fields before enrollment merge */
export interface MappedCustomer {
  id: string
  name: string
  email: string
  phone?: string | null
  memberSince: string
  customerRole: PPCustomerRole | null
}

/** MemberData + payment alert flag + raw customer role */
export interface MemberDataWithFlags extends MemberData {
  hasPaymentAlert: boolean
  customerRole: PPCustomerRole | null
}

// ── ppApiHeaders ──────────────────────────────────────────────────────────────

/**
 * Returns the correct HTTP headers for the PushPress Platform API.
 * Uses API-KEY header (NOT Authorization: Bearer).
 */
export function ppApiHeaders(
  apiKey: string,
  companyId?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'API-KEY': apiKey,
    'Content-Type': 'application/json',
  }
  if (companyId) {
    headers['company-id'] = companyId
  }
  return headers
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

/**
 * GET from the Platform API. Handles both array and { data: [] } response shapes.
 */
export async function ppGet<T>(
  apiKey: string,
  path: string,
  params: Record<string, string> = {},
  companyId?: string,
): Promise<T[]> {
  const url = new URL(`${PP_PLATFORM_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString(), {
    headers: ppApiHeaders(apiKey, companyId),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`PushPress Platform API ${res.status} ${path}: ${text}`)
  }

  const body = await res.json()
  // API returns either [...] or { data: [...] }
  return (Array.isArray(body) ? body : (body.data ?? [])) as T[]
}

// ── mapCustomer ───────────────────────────────────────────────────────────────

/**
 * Map a PPCustomer → MappedCustomer.
 * Handles the nested name object and memberSince fallback.
 */
export function mapCustomer(customer: PPCustomer): MappedCustomer {
  const first = customer.name.first ?? ''
  const last = customer.name.last ?? ''
  const displayName = [first, last].filter(Boolean).join(' ') || customer.email || customer.id

  const memberSince =
    customer.membershipDetails?.initialMembershipStartDate ??
    new Date().toISOString().split('T')[0]

  return {
    id: customer.id,
    name: displayName,
    email: customer.email,
    phone: customer.phone,
    memberSince,
    customerRole: customer.role ?? null,
  }
}

// ── mapEnrollmentStatus ───────────────────────────────────────────────────────

/**
 * Map a PushPress enrollment status to our MemberData status.
 *
 * Enrollment status semantics:
 *   active       → active (paying)
 *   alert        → active but has payment issue (flag separately)
 *   canceled     → cancelled
 *   completed    → cancelled (plan ran its course, e.g. session pack done)
 *   paused       → paused
 *   pendactivation → active (about to start, treat as active)
 *   pendcancel   → active (still paying until end of period)
 */
export function mapEnrollmentStatus(
  status: PPEnrollmentStatus | string | undefined,
): MemberData['status'] {
  switch (status) {
    case 'active':
    case 'alert':         // payment issue but still enrolled
    case 'pendactivation':
    case 'pendcancel':    // scheduled to cancel but still active
      return 'active'
    case 'canceled':
    case 'completed':
      return 'cancelled'
    case 'paused':
      return 'paused'
    default:
      return 'active'     // safe default
  }
}

/**
 * Map customer.role to MemberData.status when there's no enrollment.
 */
export function mapCustomerRoleToStatus(role: PPCustomerRole | null | undefined): MemberData['status'] {
  switch (role) {
    case 'member':
    case 'admin':
    case 'coach':
    case 'frontdesk':
    case 'superuser':
      return 'active'
    case 'ex-member':
    case 'non-member':
      return 'cancelled'
    case 'lead':
      return 'prospect'
    default:
      return 'active'
  }
}

// ── normalizeMonthlyRevenue ───────────────────────────────────────────────────

/**
 * Convert a billing schedule + face-value amount to normalized monthly revenue.
 *
 * The billingSchedule.interval multiplies the period:
 *   period=month, interval=3 → billed every 3 months → amount/3 per month
 *   period=year,  interval=2 → billed every 2 years  → amount/24 per month
 *
 * @param schedule - The enrollment's billingSchedule
 * @param amount   - The face value of the bill (from Plan or known price)
 */
export function normalizeMonthlyRevenue(
  schedule: PPBillingSchedule | undefined,
  amount: number,
): number {
  if (!schedule || !amount) return 0
  const { period, interval } = schedule
  const effectiveInterval = interval || 1

  switch (period) {
    case 'month':
      return amount / effectiveInterval
    case 'week':
      // weeks per month ≈ 4.33; divide by interval if billing every N weeks
      return (amount * 4.33) / effectiveInterval
    case 'year':
      return amount / (12 * effectiveInterval)
    case 'day':
      return (amount * 30) / effectiveInterval
    case 'once':
      // Non-recurring — no monthly revenue contribution
      return 0
    default:
      return amount / effectiveInterval
  }
}

// ── buildMemberData ───────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Build a MemberDataWithFlags from a customer, their enrollment, and their checkins.
 *
 * Checkin attendance rules (from spec):
 *   - Only kind='class' | 'event' | 'open' count as attendance
 *   - Only role='attendee' counts (exclude 'staff', 'coach', 'assistant')
 *   - Only result='success' counts
 *   - Timestamp is unix ms
 *
 * Windows:
 *   recent:   0–30 days ago  → recentCheckinsCount
 *   previous: 31–60 days ago → previousCheckinsCount
 *
 * @param customer   - PPCustomer from /customers
 * @param enrollment - PPEnrollment from /enrollments (null if none)
 * @param checkins   - ALL checkins for this customer (recent + previous window)
 * @param now        - Reference time (injected for testability)
 * @param monthlyRevenue - Pre-computed monthly revenue (from enrollment + plan price)
 */
export function buildMemberData(
  customer: PPCustomer,
  enrollment: PPEnrollment | null,
  checkins: PPCheckin[],
  now: Date,
  monthlyRevenue = 0,
): MemberDataWithFlags {
  const mapped = mapCustomer(customer)

  // Determine member status
  const hasPaymentAlert = enrollment?.status === 'alert'
  const status = enrollment
    ? mapEnrollmentStatus(enrollment.status)
    : mapCustomerRoleToStatus(customer.role)

  // Count valid attendance checkins
  const thirtyDaysAgoMs = now.getTime() - 30 * MS_PER_DAY
  const sixtyDaysAgoMs = now.getTime() - 60 * MS_PER_DAY

  let recentCheckinsCount = 0
  let previousCheckinsCount = 0
  let maxRecentTs: number | undefined

  for (const checkin of checkins) {
    // Only count attendee check-ins with successful result
    if (checkin.role !== 'attendee') continue
    if (checkin.result !== 'success') continue
    // appointment checkins have no role field — skip for attendance counting
    if (checkin.kind === 'appointment') continue

    const ts = checkin.timestamp

    if (ts >= thirtyDaysAgoMs) {
      recentCheckinsCount++
      if (maxRecentTs === undefined || ts > maxRecentTs) {
        maxRecentTs = ts
      }
    } else if (ts >= sixtyDaysAgoMs) {
      previousCheckinsCount++
    }
  }

  const lastCheckinAt = maxRecentTs !== undefined
    ? new Date(maxRecentTs).toISOString()
    : undefined

  return {
    id: mapped.id,
    name: mapped.name,
    email: mapped.email,
    phone: mapped.phone ?? undefined,
    status,
    membershipType: enrollment?.planId ?? 'unknown',
    memberSince: mapped.memberSince,
    lastCheckinAt,
    recentCheckinsCount,
    previousCheckinsCount,
    renewalDate: enrollment?.nextCharge ?? undefined,
    monthlyRevenue,
    customerRole: mapped.customerRole,
    hasPaymentAlert,
  }
}
