import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** GET /api/workflows?gymId=xxx — list templates (system + gym-specific) */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const gymId = searchParams.get('gymId')

  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .or(`gym_id.is.null${gymId ? `,gym_id.eq.${gymId}` : ''}`)
    .eq('enabled', true)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ workflows: data })
}

/** POST /api/workflows — create a new workflow */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { gymId, name, goal, steps, timeoutDays, triggerConfig } = body

  if (!name || !goal || !steps?.length) {
    return NextResponse.json({ error: 'name, goal, steps required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('workflows')
    .insert({
      gym_id: gymId ?? null,
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
