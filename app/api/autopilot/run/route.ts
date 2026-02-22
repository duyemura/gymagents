import { NextRequest, NextResponse } from 'next/server'
import { getSession, getTier } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { createPushPressClient, getAtRiskMembers } from '@/lib/pushpress'
import { runAtRiskDetector } from '@/lib/claude'
import { decrypt } from '@/lib/encrypt'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    // Get user and gym
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
    
    if (!gym) {
      return NextResponse.json({ error: 'No gym connected' }, { status: 400 })
    }
    
    const tier = getTier(user)
    
    // Check run limits for free tier
    if (tier === 'free') {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      
      const { count } = await supabaseAdmin
        .from('agent_runs')
        .select('*', { count: 'exact', head: true })
        .eq('gym_id', gym.id)
        .gte('created_at', startOfMonth.toISOString())
      
      if ((count || 0) >= 3) {
        return NextResponse.json({ 
          error: 'Monthly limit reached',
          upgradeRequired: true,
          message: "You've used your 3 free scans this month. Upgrade to Starter to run daily scans."
        }, { status: 403 })
      }
    }
    
    // Fetch PushPress data
    const apiKey = decrypt(gym.pushpress_api_key)
    const client = createPushPressClient(apiKey, gym.pushpress_company_id)
    
    // Create run record
    const { data: run } = await supabaseAdmin
      .from('agent_runs')
      .insert({
        gym_id: gym.id,
        agent_type: 'at_risk_detector',
        status: 'running',
        input_summary: `Scanning ${gym.member_count} members for churn risk`
      })
      .select()
      .single()
    
    // Get at-risk members from PushPress
    let atRiskMembers = await getAtRiskMembers(client, gym.pushpress_company_id)
    
    // For demo/testing: if no real data, generate sample data
    if (atRiskMembers.length === 0) {
      const now = new Date()
      atRiskMembers = [
        {
          id: 'demo-1',
          name: 'Sarah Johnson',
          email: 'sarah@example.com',
          lastCheckin: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000),
          daysSinceCheckin: 18,
          averageWeeklyCheckins: 3.2,
          membershipType: 'Unlimited Monthly',
          memberSince: new Date(now.getTime() - 280 * 24 * 60 * 60 * 1000),
          riskScore: 75
        },
        {
          id: 'demo-2',
          name: 'Mike Torres',
          email: 'mike@example.com',
          lastCheckin: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
          daysSinceCheckin: 25,
          averageWeeklyCheckins: 2.1,
          membershipType: 'Monthly',
          memberSince: new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000),
          riskScore: 85
        },
        {
          id: 'demo-3',
          name: 'Emma Walsh',
          email: 'emma@example.com',
          lastCheckin: new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000),
          daysSinceCheckin: 16,
          averageWeeklyCheckins: 4.5,
          membershipType: 'Unlimited Monthly',
          memberSince: new Date(now.getTime() - 450 * 24 * 60 * 60 * 1000),
          riskScore: 60
        }
      ]
    }
    
    // Limit for free tier
    const membersForAnalysis = tier === 'free' ? atRiskMembers.slice(0, 5) : atRiskMembers
    
    // Run Claude analysis
    const agentOutput = await runAtRiskDetector(gym.gym_name, membersForAnalysis, tier)
    
    // Store actions
    for (const action of agentOutput.actions) {
      await supabaseAdmin.from('agent_actions').insert({
        agent_run_id: run!.id,
        action_type: 'message_draft',
        content: action,
        approved: null,
        dismissed: null
      })
    }
    
    // Update run record
    await supabaseAdmin
      .from('agent_runs')
      .update({
        status: 'completed',
        output: agentOutput,
        input_summary: `Found ${agentOutput.totalAtRisk} at-risk members out of ${gym.member_count} total`
      })
      .eq('id', run!.id)
    
    // Update autopilot stats
    const { data: currentAutopilot } = await supabaseAdmin
      .from('autopilots')
      .select('run_count')
      .eq('gym_id', gym.id)
      .eq('skill_type', 'at_risk_detector')
      .single()
    
    await supabaseAdmin
      .from('autopilots')
      .update({
        last_run_at: new Date().toISOString(),
        run_count: (currentAutopilot?.run_count || 0) + 1
      })
      .eq('gym_id', gym.id)
      .eq('skill_type', 'at_risk_detector')
    
    return NextResponse.json({
      success: true,
      runId: run!.id,
      output: agentOutput,
      tier
    })
  } catch (error: any) {
    console.error('Autopilot run error:', error)
    return NextResponse.json({ error: error.message || 'Autopilot run failed' }, { status: 500 })
  }
}
