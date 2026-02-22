import { NextRequest, NextResponse } from 'next/server'
import { getSession, getTier } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', session.id)
    .single()
  
  const { data: gym } = await supabaseAdmin
    .from('gyms')
    .select('*')
    .eq('user_id', session.id)
    .single()
  
  const tier = getTier(user)
  
  // Get autopilots
  let autopilots: any[] = []
  if (gym) {
    const { data } = await supabaseAdmin
      .from('autopilots')
      .select('*')
      .eq('gym_id', gym.id)
    autopilots = data || []
  }
  
  // Get recent runs
  let recentRuns: any[] = []
  if (gym) {
    const { data } = await supabaseAdmin
      .from('agent_runs')
      .select('*')
      .eq('gym_id', gym.id)
      .order('created_at', { ascending: false })
      .limit(5)
    recentRuns = data || []
  }
  
  // Get pending actions (not approved/dismissed)
  let pendingActions: any[] = []
  if (gym && recentRuns.length > 0) {
    const runIds = recentRuns.map(r => r.id)
    const { data } = await supabaseAdmin
      .from('agent_actions')
      .select('*')
      .in('agent_run_id', runIds)
      .is('approved', null)
      .is('dismissed', null)
      .order('created_at', { ascending: false })
    pendingActions = data || []
  }
  
  // Get monthly run count
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  let monthlyRunCount = 0
  if (gym) {
    const { count } = await supabaseAdmin
      .from('agent_runs')
      .select('*', { count: 'exact', head: true })
      .eq('gym_id', gym.id)
      .gte('created_at', startOfMonth.toISOString())
    monthlyRunCount = count || 0
  }
  
  return NextResponse.json({
    user,
    gym,
    tier,
    autopilots,
    recentRuns,
    pendingActions,
    monthlyRunCount
  })
}
