export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAccountForUser } from '@/lib/db/accounts'
import { supabaseAdmin } from '@/lib/supabase'
import { decrypt } from '@/lib/encrypt'
import { syncBusinessStats } from '@/lib/sync-business-stats'

/**
 * POST /api/sync/refresh
 *
 * Manually refresh business stats from PushPress. Writes updated
 * business_stats memory with current member counts, attendance, etc.
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const account = await getAccountForUser(session.id)
    if (!account) {
      return NextResponse.json({ error: 'No account connected' }, { status: 400 })
    }

    const accountId = (account as any).id
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from('accounts')
      .select('pushpress_api_key, pushpress_company_id, avg_membership_price')
      .eq('id', accountId)
      .single()

    if (fetchErr || !row?.pushpress_api_key) {
      return NextResponse.json({ error: 'No PushPress connection found' }, { status: 400 })
    }

    const apiKey = decrypt(row.pushpress_api_key)
    const companyId = row.pushpress_company_id || ''
    const avgPrice = row.avg_membership_price || 150

    const { stats } = await syncBusinessStats(accountId, apiKey, companyId, avgPrice)

    return NextResponse.json({ stats })
  } catch (err: any) {
    console.error('[sync/refresh] Error:', err.message)
    return NextResponse.json(
      { error: err.message || 'Failed to sync' },
      { status: 500 },
    )
  }
}
