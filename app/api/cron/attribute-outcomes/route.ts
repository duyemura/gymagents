import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { tryDecrypt } from '@/lib/encrypt'
import { ppGet } from '@/lib/pushpress-platform'
import type { PPCheckin } from '@/lib/pushpress-platform'

export const dynamic = 'force-dynamic'

/**
 * Attribution cron — checks agent_tasks for member re-engagement.
 *
 * For tasks with status in ('resolved', 'awaiting_reply') and no outcome yet:
 * - Check PushPress checkins API for that member since task creation
 * - If checkin found: outcome='engaged', attributed_value = gym's avg membership price
 * - If 14-day window expired with no checkin and no reply: outcome='unresponsive'
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Get tasks that need attribution checking
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: tasks, error: tasksError } = await supabaseAdmin
    .from('agent_tasks')
    .select('*')
    .in('status', ['resolved', 'awaiting_reply'])
    .is('outcome', null)
    .not('member_email', 'is', null)
    .gte('created_at', fourteenDaysAgo)

  if (tasksError) {
    console.error('[attribute-outcomes] Fetch error:', tasksError)
    return NextResponse.json({ error: tasksError.message }, { status: 500 })
  }

  if (!tasks?.length) return NextResponse.json({ checked: 0, attributed: 0, expired: 0 })

  // Fetch accounts with PushPress credentials (no FK on agent_tasks → accounts)
  const accountIds = [...new Set(tasks.map((t: any) => t.account_id))]
  const { data: accountRows } = await supabaseAdmin
    .from('accounts')
    .select('id, pushpress_api_key, pushpress_company_id')
    .in('id', accountIds)
    .not('pushpress_api_key', 'is', null)

  const accountMap = new Map((accountRows ?? []).map(a => [a.id, a]))

  let attributed = 0
  let expired = 0

  for (const task of tasks) {
    const account = accountMap.get((task as any).account_id)
    if (!account?.pushpress_api_key) continue

    const taskCreatedAt = new Date(task.created_at)
    const windowExpired = Date.now() - taskCreatedAt.getTime() > 14 * 24 * 60 * 60 * 1000

    try {
      // Check if member checked in since task was created via Platform API v1
      const apiKey = tryDecrypt(account.pushpress_api_key)

      const createdAtSec = Math.floor(taskCreatedAt.getTime() / 1000)
      const nowSec = Math.floor(Date.now() / 1000)
      const checkins = await ppGet<PPCheckin>(
        apiKey,
        '/checkins',
        { startTimestamp: String(createdAtSec), endTimestamp: String(nowSec) },
        account.pushpress_company_id,
      )
      const hasCheckin = checkins.some(c => c.customer === task.member_id)

      if (hasCheckin) {
        await supabaseAdmin
          .from('agent_tasks')
          .update({
            outcome: 'engaged',
            outcome_reason: 'checkin_after_outreach',
            outcome_score: 80,
            attributed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', task.id)
        attributed++
      } else if (windowExpired) {
        await supabaseAdmin
          .from('agent_tasks')
          .update({
            outcome: 'unresponsive',
            outcome_reason: 'no_checkin_within_attribution_window',
            updated_at: new Date().toISOString(),
          })
          .eq('id', task.id)
        expired++
      }
    } catch (e) {
      console.error('[attribute-outcomes] Check failed for task', task.id, e)
    }
  }

  console.log(`[attribute-outcomes] checked=${tasks.length} attributed=${attributed} expired=${expired}`)

  return NextResponse.json({ checked: tasks.length, attributed, expired })
}

export const POST = GET
