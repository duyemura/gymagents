/**
 * sync-business-stats.ts
 *
 * Fetches real metrics from PushPress and writes them as a `business_stats`
 * memory. These are plain numbers — factual, refreshable, no opinions.
 *
 * The AI reads these alongside the `gym_context` (business profile) memory
 * when reasoning about a business. Stats refresh on every sync; the profile
 * only changes when the AI learns something new or the owner edits it.
 *
 * Call from: setup/recommend, manual refresh, or analysis cron.
 */

import { createPushPressClient } from './pushpress'
import {
  getAccountMemories,
  updateMemory,
  createMemory,
} from './db/memories'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BusinessStats {
  totalMembers: number
  active: number
  paused: number
  cancelled: number
  leads: number
  newLast30Days: number
  cancelledLast30Days: number
  avgVisitsPerWeek: number | null   // null if no checkin data sampled
  attendanceTrend: 'improving' | 'stable' | 'declining' | 'unknown'
  estimatedMRR: number              // monthly recurring revenue estimate
  syncedAt: string                  // ISO timestamp
}

export interface SyncResult {
  stats: BusinessStats
  memoryId: string
}

// ── Core sync function ────────────────────────────────────────────────────────

/**
 * Fetch current metrics from PushPress v3 and write/update business_stats memory.
 * Returns the stats object and the memory ID.
 */
export async function syncBusinessStats(
  accountId: string,
  apiKey: string,
  companyId: string,
  avgMembershipPrice: number,
): Promise<SyncResult> {
  const client = createPushPressClient(apiKey, companyId)
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)

  // ── Fetch all customers (paginated) ───────────────────────────────────────

  const customers: any[] = []
  let page = 1
  const MAX_PAGES = 5
  while (page <= MAX_PAGES) {
    const response = await client.fetch(`/customers?limit=100&page=${page}`)
    const batch: any[] =
      response?.data?.resultArray ??
      response?.data ??
      response?.resultArray ??
      (Array.isArray(response) ? response : [])
    if (!Array.isArray(batch) || batch.length === 0) break
    customers.push(...batch)
    if (batch.length < 100) break
    page++
  }

  // ── Classify members ──────────────────────────────────────────────────────

  let active = 0
  let paused = 0
  let cancelled = 0
  let leads = 0
  let newLast30Days = 0
  let cancelledLast30Days = 0

  const activeCustomerIds: string[] = []

  for (const c of customers) {
    const status = mapStatus(c)
    const memberSince = parseDateField(c, sixMonthsAgo)

    if (status === 'prospect') { leads++; continue }
    if (status === 'cancelled') {
      cancelled++
      if (memberSince >= thirtyDaysAgo) cancelledLast30Days++
      continue
    }
    if (status === 'paused') { paused++; continue }

    // active
    active++
    activeCustomerIds.push(c.id)
    if (memberSince >= thirtyDaysAgo) newLast30Days++
  }

  // ── Sample attendance from active members ──────────────────────────────────

  const SAMPLE_SIZE = Math.min(activeCustomerIds.length, 30)
  let totalRecentCheckins = 0
  let totalPreviousCheckins = 0
  let sampledCount = 0

  for (let i = 0; i < SAMPLE_SIZE; i++) {
    try {
      const resp = await client.fetch(`/checkins/class?customer=${activeCustomerIds[i]}&limit=50`)
      const checkins: any[] =
        resp?.data?.resultArray ??
        resp?.data ??
        (Array.isArray(resp) ? resp : [])

      let recent = 0
      let previous = 0
      for (const chk of checkins) {
        const d = new Date(chk.date || chk.checkedInAt || chk.created_at || chk.createdAt)
        if (isNaN(d.getTime())) continue
        if (d >= thirtyDaysAgo) recent++
        else if (d >= sixtyDaysAgo) previous++
      }

      totalRecentCheckins += recent
      totalPreviousCheckins += previous
      sampledCount++
    } catch {
      // Skip failures — still count what we can
    }
  }

  // ── Compute metrics ───────────────────────────────────────────────────────

  const avgVisitsPerWeek = sampledCount > 0
    ? Math.round((totalRecentCheckins / sampledCount / 4.3) * 10) / 10
    : null

  let attendanceTrend: BusinessStats['attendanceTrend'] = 'unknown'
  if (sampledCount > 0 && totalPreviousCheckins > 0) {
    const ratio = totalRecentCheckins / totalPreviousCheckins
    if (ratio > 1.15) attendanceTrend = 'improving'
    else if (ratio < 0.85) attendanceTrend = 'declining'
    else attendanceTrend = 'stable'
  }

  const estimatedMRR = active * avgMembershipPrice

  const stats: BusinessStats = {
    totalMembers: customers.length,
    active,
    paused,
    cancelled,
    leads,
    newLast30Days,
    cancelledLast30Days,
    avgVisitsPerWeek,
    attendanceTrend,
    estimatedMRR,
    syncedAt: now.toISOString(),
  }

  // ── Write to memory ───────────────────────────────────────────────────────

  const memoryId = await writeStatsMemory(accountId, stats)

  return { stats, memoryId }
}

// ── Write stats from an existing snapshot (avoids double-fetching) ───────────

/**
 * Build stats from a snapshot that was already fetched (e.g. by the recommend
 * endpoint) and write them to the business_stats memory. Avoids calling
 * PushPress a second time.
 */
export async function writeStatsFromSnapshot(
  accountId: string,
  snapshot: { members: Array<{ status: string; memberSince: string; recentCheckinsCount: number; previousCheckinsCount: number; monthlyRevenue: number }> },
  avgMembershipPrice: number,
): Promise<string> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  let active = 0, paused = 0, cancelled = 0, leads = 0
  let newLast30Days = 0, cancelledLast30Days = 0
  let totalRecent = 0, totalPrevious = 0, sampledCount = 0

  for (const m of snapshot.members) {
    const memberSince = new Date(m.memberSince)

    if (m.status === 'prospect') { leads++; continue }
    if (m.status === 'cancelled') {
      cancelled++
      if (!isNaN(memberSince.getTime()) && memberSince >= thirtyDaysAgo) cancelledLast30Days++
      continue
    }
    if (m.status === 'paused') { paused++; continue }

    active++
    if (!isNaN(memberSince.getTime()) && memberSince >= thirtyDaysAgo) newLast30Days++

    if (m.recentCheckinsCount > 0 || m.previousCheckinsCount > 0) {
      totalRecent += m.recentCheckinsCount
      totalPrevious += m.previousCheckinsCount
      sampledCount++
    }
  }

  const avgVisitsPerWeek = sampledCount > 0
    ? Math.round((totalRecent / sampledCount / 4.3) * 10) / 10
    : null

  let attendanceTrend: BusinessStats['attendanceTrend'] = 'unknown'
  if (sampledCount > 0 && totalPrevious > 0) {
    const ratio = totalRecent / totalPrevious
    if (ratio > 1.15) attendanceTrend = 'improving'
    else if (ratio < 0.85) attendanceTrend = 'declining'
    else attendanceTrend = 'stable'
  }

  const stats: BusinessStats = {
    totalMembers: snapshot.members.length,
    active,
    paused,
    cancelled,
    leads,
    newLast30Days,
    cancelledLast30Days,
    avgVisitsPerWeek,
    attendanceTrend,
    estimatedMRR: active * avgMembershipPrice,
    syncedAt: now.toISOString(),
  }

  return writeStatsMemory(accountId, stats)
}

// ── Format stats as a memory string ─────────────────────────────────────────

export function formatStatsForMemory(stats: BusinessStats): string {
  const lines: string[] = []

  // Member breakdown
  const parts = [`${stats.active} active`]
  if (stats.paused > 0) parts.push(`${stats.paused} paused`)
  if (stats.cancelled > 0) parts.push(`${stats.cancelled} cancelled`)
  if (stats.leads > 0) parts.push(`${stats.leads} leads`)
  lines.push(`Members: ${stats.totalMembers} total (${parts.join(', ')})`)

  // Changes
  if (stats.newLast30Days > 0 || stats.cancelledLast30Days > 0) {
    const changes: string[] = []
    if (stats.newLast30Days > 0) changes.push(`+${stats.newLast30Days} new`)
    if (stats.cancelledLast30Days > 0) changes.push(`-${stats.cancelledLast30Days} cancelled`)
    lines.push(`Last 30 days: ${changes.join(', ')}`)
  }

  // Attendance
  if (stats.avgVisitsPerWeek !== null) {
    lines.push(`Avg attendance: ${stats.avgVisitsPerWeek} visits/week (trend: ${stats.attendanceTrend})`)
  }

  // Revenue
  if (stats.estimatedMRR > 0) {
    const mrr = stats.estimatedMRR >= 1000
      ? `$${Math.round(stats.estimatedMRR / 1000)}k`
      : `$${Math.round(stats.estimatedMRR)}`
    lines.push(`Estimated MRR: ${mrr}/mo`)
  }

  // Sync time
  const syncDate = new Date(stats.syncedAt)
  lines.push(`Last synced: ${syncDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`)

  return lines.join('\n')
}

// ── Write/update the business_stats memory ──────────────────────────────────

async function writeStatsMemory(accountId: string, stats: BusinessStats): Promise<string> {
  const content = formatStatsForMemory(stats)

  // Find existing business_stats memory
  const existing = await getAccountMemories(accountId, { category: 'business_stats' })
  const statsMemory = existing.find(m => m.source === 'system')

  if (statsMemory) {
    await updateMemory(statsMemory.id, { content })
    return statsMemory.id
  }

  const created = await createMemory({
    accountId,
    category: 'business_stats',
    content,
    importance: 5,
    scope: 'global',
    source: 'system',
  })
  return created.id
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapStatus(customer: any): 'active' | 'paused' | 'cancelled' | 'prospect' {
  const role = customer.role || customer.customer_role || ''
  const status = customer.status || ''

  if (role === 'lead' || status === 'lead') return 'prospect'
  if (role === 'ex-member' || status === 'cancelled' || status === 'canceled') return 'cancelled'
  if (role === 'non-member') return 'cancelled'
  if (status === 'paused' || status === 'frozen') return 'paused'
  return 'active'
}

function parseDateField(customer: any, fallback: Date): Date {
  const raw =
    customer.memberSince || customer.member_since ||
    customer.joinDate || customer.join_date ||
    customer.startDate || customer.start_date ||
    customer.created_at || customer.createdAt ||
    customer.date_added || customer.dateAdded
  if (!raw) return fallback
  const d = new Date(raw)
  return isNaN(d.getTime()) ? fallback : d
}
