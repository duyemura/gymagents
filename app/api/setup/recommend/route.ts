export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAccountForUser } from '@/lib/db/accounts'
import { supabaseAdmin } from '@/lib/supabase'
import { decrypt } from '@/lib/encrypt'
import { createPushPressClient } from '@/lib/pushpress'
import { recommend, analyzeSnapshot } from '@/lib/setup-recommend'
import { getAccountMemories, updateMemory, createMemory } from '@/lib/db/memories'
import type { AccountSnapshot, MemberData, PaymentEvent } from '@/lib/agents/GMAgent'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const account = await getAccountForUser(session.id)
    if (!account) {
      return NextResponse.json({ error: 'No account connected — connect your gym first' }, { status: 400 })
    }

    const accountId = (account as any).id
    const { data: accountRow, error: fetchErr } = await supabaseAdmin
      .from('accounts')
      .select('pushpress_api_key, pushpress_company_id, account_name, member_count, avg_membership_price')
      .eq('id', accountId)
      .single()

    if (fetchErr || !accountRow?.pushpress_api_key) {
      return NextResponse.json({ error: 'No PushPress connection found — reconnect your gym' }, { status: 400 })
    }

    const apiKey = decrypt(accountRow.pushpress_api_key)
    const companyId = accountRow.pushpress_company_id || ''
    const accountName = accountRow.account_name || 'Your Gym'
    const avgPrice = accountRow.avg_membership_price || 150

    console.log('[setup/recommend] Fetching data for', accountName)

    // Build a quick snapshot using the v3 API (which actually works in production)
    const snapshot = await buildQuickSnapshot(apiKey, companyId, accountId, accountName, avgPrice)

    console.log('[setup/recommend] Snapshot:', snapshot.members.length, 'members')

    const recommendation = recommend(snapshot)

    console.log('[setup/recommend] Recommendation:', recommendation.agentType, '-', recommendation.name)

    // Update business context memory with accurate data from paginated fetch
    const analysis = analyzeSnapshot(snapshot)
    await refreshBusinessContextMemory(accountId, accountName, analysis)

    return NextResponse.json({
      recommendation,
      snapshotSummary: {
        totalMembers: snapshot.members.length,
        accountName,
      },
    })
  } catch (err: any) {
    console.error('[setup/recommend] Error:', err.message)
    return NextResponse.json(
      { error: err.message || 'Failed to analyze your business' },
      { status: 500 },
    )
  }
}

/**
 * Build a lightweight AccountSnapshot using the PushPress v3 API.
 * Fetches customers (paginated) + recent checkins for a sample of members.
 * Good enough for a recommendation — doesn't need the full Platform v1 data.
 */
async function buildQuickSnapshot(
  apiKey: string,
  companyId: string,
  accountId: string,
  accountName: string,
  avgPrice: number,
): Promise<AccountSnapshot> {
  const client = createPushPressClient(apiKey, companyId)
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)

  // Step 1: Fetch all customers (paginated — v3 caps at 100 per page)
  let customers: any[] = []
  try {
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
      if (batch.length < 100) break // last page
      page++
    }
  } catch (err: any) {
    console.error('[setup/recommend] /customers failed:', err.message)
    throw new Error(`Could not fetch member data from PushPress: ${err.message}`)
  }

  console.log('[setup/recommend] Fetched', customers.length, 'customers total')

  // Log a sample customer to see actual field names
  if (customers.length > 0) {
    console.log('[setup/recommend] Sample customer keys:', Object.keys(customers[0]))
    console.log('[setup/recommend] Sample customer:', JSON.stringify(customers[0]).slice(0, 800))
  }

  // Step 2: For a sample of active members, fetch recent checkins to assess attendance
  const sampleSize = Math.min(customers.length, 30)
  const members: MemberData[] = []

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i]
    const name = formatV3Name(c)
    const email = c.email || ''
    const status = mapV3Status(c)

    // For the sample, fetch checkins to get attendance data
    let recentCheckinsCount = 0
    let previousCheckinsCount = 0

    if (i < sampleSize && (status === 'active' || status === 'paused')) {
      try {
        const checkinResp = await client.fetch(`/checkins/class?customer=${c.id}&limit=50`)
        const checkins: any[] =
          checkinResp?.data?.resultArray ??
          checkinResp?.data ??
          (Array.isArray(checkinResp) ? checkinResp : [])

        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

        for (const chk of checkins) {
          const d = new Date(chk.date || chk.checkedInAt || chk.created_at || chk.createdAt)
          if (isNaN(d.getTime())) continue
          if (d >= thirtyDaysAgo) recentCheckinsCount++
          else if (d >= sixtyDaysAgo) previousCheckinsCount++
        }
      } catch {
        // Skip checkin fetch failures — still include the member
      }
    }

    // memberSince: try multiple field names, default to 6 months ago (not now)
    const memberSince =
      c.memberSince || c.member_since || c.joinDate || c.join_date ||
      c.startDate || c.start_date || c.created_at || c.createdAt ||
      c.date_added || c.dateAdded ||
      sixMonthsAgo.toISOString()

    members.push({
      id: c.id || `member-${i}`,
      name,
      email,
      status,
      membershipType: c.membership_type || c.membershipType || c.plan || 'Monthly',
      memberSince,
      recentCheckinsCount,
      previousCheckinsCount,
      monthlyRevenue: avgPrice,
    })
  }

  return {
    accountId,
    accountName,
    members,
    recentCheckins: [],
    recentLeads: [],
    paymentEvents: [],
    capturedAt: now.toISOString(),
  }
}

/**
 * Refresh the business context memory with accurate data from the paginated fetch.
 * The bootstrap LLM call during connect only saw the first page of customers,
 * so the memory often has a stale member count. This updates it with real numbers.
 */
async function refreshBusinessContextMemory(
  accountId: string,
  accountName: string,
  analysis: import('@/lib/setup-recommend').SnapshotAnalysis,
) {
  try {
    const existing = await getAccountMemories(accountId, { category: 'gym_context' })
    const businessContextMemory = existing.find(m => m.source === 'agent' && m.importance === 5)

    // Build a richer context string from what we actually discovered
    const parts: string[] = []
    parts.push(`${accountName} has ${analysis.totalMembers} members`)
    if (analysis.activeMembers.length > 0) {
      parts[0] += ` (${analysis.activeMembers.length} active)`
    }
    if (analysis.atRiskMembers.length > 0) {
      parts.push(`${analysis.atRiskMembers.length} members show declining attendance`)
    }
    if (analysis.recentlyCancelled.length > 0) {
      parts.push(`${analysis.recentlyCancelled.length} recently cancelled`)
    }
    if (analysis.newMembers.length > 0) {
      parts.push(`${analysis.newMembers.length} new members in last 30 days`)
    }
    if (analysis.leads.length > 0) {
      parts.push(`${analysis.leads.length} open leads`)
    }
    if (analysis.totalMonthlyRevenue > 0) {
      const rev = analysis.totalMonthlyRevenue >= 1000
        ? `$${Math.round(analysis.totalMonthlyRevenue / 1000)}k`
        : `$${Math.round(analysis.totalMonthlyRevenue)}`
      parts.push(`estimated monthly revenue: ${rev}`)
    }

    const updatedContent = parts.join('. ') + '.'

    if (businessContextMemory) {
      await updateMemory(businessContextMemory.id, { content: updatedContent })
      console.log('[setup/recommend] Updated business context memory')
    } else {
      await createMemory({
        accountId,
        category: 'gym_context',
        content: updatedContent,
        importance: 5,
        scope: 'global',
        source: 'agent',
      })
      console.log('[setup/recommend] Created business context memory')
    }
  } catch (err: any) {
    // Non-blocking — recommendation still works even if memory update fails
    console.error('[setup/recommend] Memory update failed:', err.message)
  }
}

function formatV3Name(customer: any): string {
  const first = customer.first_name || customer.firstName || ''
  const last = customer.last_name || customer.lastName || ''
  const full = `${first} ${last}`.trim()
  return full || customer.name || customer.email || 'Member'
}

function mapV3Status(customer: any): MemberData['status'] {
  const role = customer.role || customer.customer_role || ''
  const status = customer.status || ''

  if (role === 'lead' || status === 'lead') return 'prospect'
  if (role === 'ex-member' || status === 'cancelled' || status === 'canceled') return 'cancelled'
  if (role === 'non-member') return 'cancelled'
  if (status === 'paused' || status === 'frozen') return 'paused'
  return 'active'
}
