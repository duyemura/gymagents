import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const { data: gym } = await supabaseAdmin
    .from('gyms')
    .select('id')
    .eq('user_id', session.id)
    .single()
  
  if (gym) {
    await supabaseAdmin.from('autopilots').delete().eq('gym_id', gym.id)
    await supabaseAdmin.from('agent_actions').delete().eq('agent_run_id', 
      supabaseAdmin.from('agent_runs').select('id').eq('gym_id', gym.id) as any
    )
    await supabaseAdmin.from('agent_runs').delete().eq('gym_id', gym.id)
    await supabaseAdmin.from('gyms').delete().eq('id', gym.id)
  }
  
  return NextResponse.json({ success: true })
}
