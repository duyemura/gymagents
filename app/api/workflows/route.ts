export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/** GET /api/workflows?accountId=xxx — list templates (system + gym-specific) */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId')

  const { data, error } = await supabaseAdmin
    .from('workflows')
    .select('*')
    .or(`gym_id.is.null${accountId ? `,gym_id.eq.${accountId}` : ''}`)
    .eq('enabled', true)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ workflows: data })
}

/** POST /api/workflows — create a new workflow */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { accountId, name, goal, steps, timeoutDays, triggerConfig } = body

  if (!name || !goal || !steps?.length) {
    return NextResponse.json({ error: 'name, goal, steps required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('workflows')
    .insert({
      account_id: accountId ?? null,
      name,
      goal,
      steps,
      timeout_days: timeoutDays ?? 30,
      trigger_config: triggerConfig ?? {},
      enabled: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ workflow: data })
}
