import Anthropic from '@anthropic-ai/sdk'
import { AtRiskMember } from './pushpress'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

export interface AgentAction {
  memberId: string
  memberName: string
  memberEmail: string
  riskLevel: 'high' | 'medium' | 'low'
  riskReason: string
  recommendedAction: string
  draftedMessage: string
  messageSubject: string
  confidence: number
  insights: string
}

export interface AgentOutput {
  summary: string
  totalAtRisk: number
  urgentCount: number
  actions: AgentAction[]
  gymInsight: string
}

export async function runAtRiskDetector(
  gymName: string,
  members: AtRiskMember[],
  tier: string
): Promise<AgentOutput> {
  const membersToAnalyze = tier === 'free' ? members.slice(0, 5) : members

  const systemPrompt = `You are the autopilot assistant for ${gymName}, a boutique fitness gym. 
You analyze member check-in patterns to identify members who are at risk of canceling their membership.
You speak directly to the gym owner in a warm, knowledgeable way — like a trusted advisor who knows their gym.
NEVER use the word "agent" or "AI". You are "the autopilot" or "your assistant."
You must output valid JSON only. No markdown, no prose outside the JSON.`

  const userPrompt = `Your autopilot scanned ${gymName}'s check-in data and found ${membersToAnalyze.length} members who may be at risk.

Here's the data for each member:
${membersToAnalyze.map(m => `
Member: ${m.name}
Email: ${m.email}
Days since last check-in: ${m.daysSinceCheckin}
Average weekly check-ins (last 30 days): ${m.averageWeeklyCheckins}
Membership type: ${m.membershipType}
Member since: ${m.memberSince.toLocaleDateString()}
Risk score: ${m.riskScore}/100
`).join('\n---\n')}

For each member, reason step by step about:
1. What specifically triggered the risk flag (be specific about the pattern)
2. What's the most likely reason they've gone quiet (life gets busy, injury, lost motivation, etc.)
3. What's the best message to re-engage them — personal, warm, gym-owner voice. Reference their specific pattern. Never sound like a template.
4. What risk level they are (high = hasn't been in 21+ days, medium = 14-20 days, low = early warning)

Output this exact JSON structure:
{
  "summary": "one sentence summary of what your autopilot found today",
  "totalAtRisk": number,
  "urgentCount": number (high risk members),
  "gymInsight": "one actionable insight about the pattern you're seeing across these members",
  "actions": [
    {
      "memberId": "string",
      "memberName": "string", 
      "memberEmail": "string",
      "riskLevel": "high" | "medium" | "low",
      "riskReason": "specific, personal reason this member was flagged (2-3 sentences)",
      "recommendedAction": "what the gym owner should do (send message, call, etc.)",
      "draftedMessage": "the actual message to send — warm, personal, not a template. Should be 3-5 sentences. Reference their specific attendance pattern.",
      "messageSubject": "email subject line (casual, not marketing-y)",
      "confidence": 0-100,
      "insights": "one insight about this specific member"
    }
  ]
}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: userPrompt
      }
    ],
    system: systemPrompt
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')
  
  // Extract JSON from response
  const text = content.text.trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in response')
  
  const result = JSON.parse(jsonMatch[0]) as AgentOutput
  return result
}
