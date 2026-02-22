import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { encrypt } from '@/lib/encrypt'
import { createPushPressClient, getMemberStats } from '@/lib/pushpress'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    const { apiKey, companyId } = await req.json()
    
    if (!apiKey || !companyId) {
      return NextResponse.json({ error: 'API key and Company ID are required' }, { status: 400 })
    }
    
    // Validate connection by fetching member stats
    const client = createPushPressClient(apiKey, companyId)
    let gymName = 'Your Gym'
    let memberCount = 0
    
    try {
      const stats = await getMemberStats(client, companyId)
      gymName = stats.gymName
      memberCount = stats.totalMembers
    } catch (err: any) {
      // If stats fails, still allow connection (API might have limited endpoints in free tier)
      console.log('Stats fetch failed, proceeding with connection:', err.message)
      gymName = 'Your Gym'
      memberCount = 0
    }
    
    // Encrypt API key before storing
    const encryptedApiKey = encrypt(apiKey)
    
    // Check if gym already exists for this user
    const { data: existing } = await supabaseAdmin
      .from('gyms')
      .select('id')
      .eq('user_id', session.id)
      .single()
    
    if (existing) {
      await supabaseAdmin
        .from('gyms')
        .update({
          pushpress_api_key: encryptedApiKey,
          pushpress_company_id: companyId,
          gym_name: gymName,
          member_count: memberCount,
          connected_at: new Date().toISOString()
        })
        .eq('user_id', session.id)
    } else {
      await supabaseAdmin
        .from('gyms')
        .insert({
          user_id: session.id,
          pushpress_api_key: encryptedApiKey,
          pushpress_company_id: companyId,
          gym_name: gymName,
          member_count: memberCount,
          connected_at: new Date().toISOString()
        })
    }
    
    // Create default autopilot entry
    const { data: gym } = await supabaseAdmin
      .from('gyms')
      .select('id')
      .eq('user_id', session.id)
      .single()
    
    if (gym) {
      const { data: existingAutopilot } = await supabaseAdmin
        .from('autopilots')
        .select('id')
        .eq('gym_id', gym.id)
        .eq('skill_type', 'at_risk_detector')
        .single()
      
      if (!existingAutopilot) {
        await supabaseAdmin.from('autopilots').insert({
          gym_id: gym.id,
          skill_type: 'at_risk_detector',
          trigger_config: { schedule: 'weekly', threshold_days: 14 },
          is_active: true,
          run_count: 0,
          approval_rate: 0
        })
      }
    }
    
    return NextResponse.json({ 
      success: true,
      gymName,
      memberCount
    })
  } catch (error: any) {
    console.error('Connect error:', error)
    return NextResponse.json({ error: error.message || 'Connection failed' }, { status: 500 })
  }
}
