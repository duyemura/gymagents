export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { callClaude } from '@/lib/claude'
import { HAIKU } from '@/lib/models'

export interface SetupGenerateResult {
  name: string
  description: string
  skill_type: string
  variations: Array<{ style: string; prompt: string }>
  suggested_trigger: {
    mode: 'cron' | 'event' | 'manual'
    schedule: 'daily' | 'weekly' | null
    event: string | null
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { goal, skillType } = await req.json()
  if (!goal || typeof goal !== 'string') {
    return NextResponse.json({ error: 'goal is required' }, { status: 400 })
  }

  const system = `You help gym and fitness business owners configure AI agents that retain members and grow their business.

Given a goal, generate an agent name, description, and three system prompt variations with different tones.
Return ONLY valid JSON — no markdown fences, no explanation.`

  const prompt = `Goal: "${goal.trim()}"
${skillType && skillType !== 'custom' ? `Skill hint: ${skillType}` : ''}

Return this exact JSON:
{
  "name": "Agent name, 3-5 words",
  "description": "One sentence: what this agent does",
  "skill_type": "snake_case identifier, e.g. at_risk_detector, payment_recovery, win_back, lead_followup",
  "variations": [
    {
      "style": "Personal & Warm",
      "prompt": "System prompt written as a caring coach. Warm, personal, relationship-focused. 3-4 sentences."
    },
    {
      "style": "Direct & Efficient",
      "prompt": "System prompt that is business-focused and concise. Gets straight to the point. 2-3 sentences."
    },
    {
      "style": "Detailed & Thorough",
      "prompt": "System prompt with specific instructions and edge cases covered. 4-5 sentences."
    }
  ],
  "suggested_trigger": {
    "mode": "cron or event or manual",
    "schedule": "daily or weekly or null",
    "event": "lead.created or member.created or member.cancelled or checkin.created or payment.failed or null"
  }
}`

  try {
    const text = await callClaude(system, prompt, HAIKU, 1500)
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Failed to generate config' }, { status: 500 })

    const config: SetupGenerateResult = JSON.parse(match[0])
    return NextResponse.json({ config })
  } catch (err: any) {
    console.error('[setup/generate] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
