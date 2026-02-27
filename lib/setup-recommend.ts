/**
 * setup-recommend.ts
 *
 * Deterministic recommendation logic for the smart setup wizard.
 * Analyzes an AccountSnapshot and recommends the best first agent
 * based on what the data shows — no AI call needed.
 *
 * Priority waterfall:
 *   1. churn_risk     — members with dropping attendance (most common, most impactful)
 *   2. payment_recovery — payment failures detected
 *   3. win_back       — recently cancelled members worth recovering
 *   4. new_member_onboarding — new members in first 30 days
 *   5. lead_followup  — leads that haven't converted
 *   6. fallback       — generic retention monitor
 */

import type { AccountSnapshot, MemberData, PaymentEvent } from './agents/GMAgent'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SetupRecommendation {
  agentType: string
  name: string
  description: string
  headline: string        // data-driven one-liner: "3 members haven't visited in 2+ weeks"
  reasoning: string       // why this agent matters for this gym
  stats: RecommendationStat[]
  trigger: {
    mode: 'cron' | 'event'
    schedule?: string     // 'daily' | 'weekly'
    event?: string        // 'member.cancelled' etc.
  }
}

export interface RecommendationStat {
  label: string
  value: string | number
  emphasis?: boolean      // highlight this stat
}

// ── Analysis helpers ─────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface SnapshotAnalysis {
  totalMembers: number
  activeMembers: MemberData[]
  atRiskMembers: MemberData[]         // active, attendance dropped significantly
  noShowMembers: MemberData[]         // active, zero recent checkins
  cancelledMembers: MemberData[]
  recentlyCancelled: MemberData[]     // cancelled in last 30 days
  newMembers: MemberData[]            // joined last 30 days
  leads: MemberData[]                 // status === 'prospect'
  paymentIssues: PaymentEvent[]
  totalMonthlyRevenue: number
  atRiskRevenue: number
}

export function analyzeSnapshot(snapshot: AccountSnapshot, now = new Date()): SnapshotAnalysis {
  const thirtyDaysAgo = new Date(now.getTime() - 30 * MS_PER_DAY).toISOString()

  const activeMembers: MemberData[] = []
  const cancelledMembers: MemberData[] = []
  const recentlyCancelled: MemberData[] = []
  const newMembers: MemberData[] = []
  const leads: MemberData[] = []
  const atRiskMembers: MemberData[] = []
  const noShowMembers: MemberData[] = []

  for (const m of snapshot.members) {
    if (m.status === 'prospect') {
      leads.push(m)
      continue
    }

    if (m.status === 'cancelled') {
      cancelledMembers.push(m)
      // "Recently cancelled" = memberSince is recent enough to still be recoverable
      // We approximate by checking if they had any recent checkins (were active recently)
      if (m.previousCheckinsCount > 0 || m.recentCheckinsCount > 0) {
        recentlyCancelled.push(m)
      }
      continue
    }

    if (m.status === 'active' || m.status === 'paused') {
      activeMembers.push(m)

      // New member: joined within 30 days
      if (m.memberSince >= thirtyDaysAgo.split('T')[0]) {
        newMembers.push(m)
      }

      // At risk: had previous checkins but recent dropped significantly
      if (m.previousCheckinsCount > 0 && m.recentCheckinsCount === 0) {
        noShowMembers.push(m)
        atRiskMembers.push(m)
      } else if (
        m.previousCheckinsCount > 2 &&
        m.recentCheckinsCount > 0 &&
        m.recentCheckinsCount <= m.previousCheckinsCount * 0.5
      ) {
        atRiskMembers.push(m)
      }
    }
  }

  const totalMonthlyRevenue = activeMembers.reduce((sum, m) => sum + (m.monthlyRevenue || 0), 0)
  const atRiskRevenue = atRiskMembers.reduce((sum, m) => sum + (m.monthlyRevenue || 0), 0)

  return {
    totalMembers: snapshot.members.length,
    activeMembers,
    atRiskMembers,
    noShowMembers,
    cancelledMembers,
    recentlyCancelled,
    newMembers,
    leads,
    paymentIssues: snapshot.paymentEvents ?? [],
    totalMonthlyRevenue,
    atRiskRevenue,
  }
}

// ── Recommendation engine ────────────────────────────────────────────────────

export function recommend(snapshot: AccountSnapshot, now = new Date()): SetupRecommendation {
  const analysis = analyzeSnapshot(snapshot, now)

  // 1. Churn risk — most common and highest value
  if (analysis.atRiskMembers.length > 0) {
    return buildChurnRiskRec(analysis)
  }

  // 2. Payment recovery
  if (analysis.paymentIssues.length > 0) {
    return buildPaymentRecoveryRec(analysis)
  }

  // 3. Win-back — recently cancelled members
  if (analysis.recentlyCancelled.length > 0) {
    return buildWinBackRec(analysis)
  }

  // 4. New member onboarding
  if (analysis.newMembers.length > 0) {
    return buildOnboardingRec(analysis)
  }

  // 5. Lead follow-up
  if (analysis.leads.length > 0) {
    return buildLeadFollowupRec(analysis)
  }

  // 6. Fallback — generic retention monitor
  return buildFallbackRec(analysis)
}

// ── Recommendation builders ──────────────────────────────────────────────────

function buildChurnRiskRec(a: SnapshotAnalysis): SetupRecommendation {
  const noShowCount = a.noShowMembers.length
  const droppingCount = a.atRiskMembers.length - noShowCount
  const revenueAtRisk = formatCurrency(a.atRiskRevenue)

  let headline: string
  if (noShowCount > 0 && droppingCount > 0) {
    headline = `${noShowCount} member${noShowCount !== 1 ? 's' : ''} stopped visiting, ${droppingCount} more dropping off`
  } else if (noShowCount > 0) {
    headline = `${noShowCount} member${noShowCount !== 1 ? 's haven\'t' : ' hasn\'t'} visited in 2+ weeks`
  } else {
    headline = `${droppingCount} member${droppingCount !== 1 ? 's' : ''} with declining attendance`
  }

  return {
    agentType: 'at_risk_detector',
    name: 'At-Risk Monitor',
    description: 'Detect members whose attendance is dropping and draft personal check-in messages before they cancel.',
    headline,
    reasoning: `${revenueAtRisk}/mo in revenue is at risk from ${a.atRiskMembers.length} member${a.atRiskMembers.length !== 1 ? 's' : ''} whose attendance has dropped. A personal check-in message recovers ~40% of at-risk members before they cancel.`,
    stats: [
      { label: 'At Risk', value: a.atRiskMembers.length, emphasis: true },
      { label: 'Revenue at Risk', value: `${revenueAtRisk}/mo`, emphasis: true },
      { label: 'Active Members', value: a.activeMembers.length },
    ],
    trigger: { mode: 'cron', schedule: 'daily' },
  }
}

function buildPaymentRecoveryRec(a: SnapshotAnalysis): SetupRecommendation {
  const failedRevenue = a.paymentIssues.reduce((sum, p) => sum + (p.amount || 0), 0)

  return {
    agentType: 'payment_recovery',
    name: 'Payment Recovery',
    description: 'Detect failed payments and send friendly recovery messages before involuntary churn happens.',
    headline: `${a.paymentIssues.length} failed payment${a.paymentIssues.length !== 1 ? 's' : ''} need attention`,
    reasoning: `${formatCurrency(failedRevenue)}/mo at risk from failed payments. Most failed payments are recoverable with a timely, friendly nudge — the member wants to stay but their card expired or hit a limit.`,
    stats: [
      { label: 'Failed Payments', value: a.paymentIssues.length, emphasis: true },
      { label: 'Revenue at Risk', value: `${formatCurrency(failedRevenue)}/mo`, emphasis: true },
      { label: 'Active Members', value: a.activeMembers.length },
    ],
    trigger: { mode: 'event', event: 'payment.failed' },
  }
}

function buildWinBackRec(a: SnapshotAnalysis): SetupRecommendation {
  const lostRevenue = a.recentlyCancelled.reduce((sum, m) => sum + (m.monthlyRevenue || 0), 0)

  return {
    agentType: 'win_back',
    name: 'Win-Back Agent',
    description: 'Reach out to recently cancelled members with a personal message to bring them back.',
    headline: `${a.recentlyCancelled.length} recently cancelled member${a.recentlyCancelled.length !== 1 ? 's' : ''} may be recoverable`,
    reasoning: `${formatCurrency(lostRevenue)}/mo lost from recent cancellations. Within the first 30 days, a personal note from the gym recovers 15-25% of cancellations — they often just need a reason to come back.`,
    stats: [
      { label: 'Recent Cancellations', value: a.recentlyCancelled.length, emphasis: true },
      { label: 'Lost Revenue', value: `${formatCurrency(lostRevenue)}/mo`, emphasis: true },
      { label: 'Total Cancelled', value: a.cancelledMembers.length },
    ],
    trigger: { mode: 'event', event: 'member.cancelled' },
  }
}

function buildOnboardingRec(a: SnapshotAnalysis): SetupRecommendation {
  return {
    agentType: 'new_member_onboarding',
    name: 'Onboarding Coach',
    description: 'Check in on new members during their first 30 days to make sure they\'re settling in and building a routine.',
    headline: `${a.newMembers.length} new member${a.newMembers.length !== 1 ? 's' : ''} in their first 30 days`,
    reasoning: `New members who don't build a habit in the first month are 3x more likely to cancel. Proactive check-ins during onboarding dramatically improve 90-day retention.`,
    stats: [
      { label: 'New Members', value: a.newMembers.length, emphasis: true },
      { label: 'Active Members', value: a.activeMembers.length },
    ],
    trigger: { mode: 'cron', schedule: 'weekly' },
  }
}

function buildLeadFollowupRec(a: SnapshotAnalysis): SetupRecommendation {
  return {
    agentType: 'lead_followup',
    name: 'Lead Follow-Up',
    description: 'Follow up with leads who haven\'t converted yet — a timely personal message makes all the difference.',
    headline: `${a.leads.length} lead${a.leads.length !== 1 ? 's' : ''} waiting for follow-up`,
    reasoning: `Leads who get a personal follow-up within 24 hours convert at 2x the rate. These ${a.leads.length} leads are in your system but haven't signed up yet.`,
    stats: [
      { label: 'Open Leads', value: a.leads.length, emphasis: true },
      { label: 'Active Members', value: a.activeMembers.length },
    ],
    trigger: { mode: 'event', event: 'lead.created' },
  }
}

function buildFallbackRec(a: SnapshotAnalysis): SetupRecommendation {
  return {
    agentType: 'at_risk_detector',
    name: 'Retention Monitor',
    description: 'Continuously monitor member attendance and flag anyone who starts slipping before they cancel.',
    headline: `${a.activeMembers.length} active member${a.activeMembers.length !== 1 ? 's' : ''} to watch over`,
    reasoning: `Even when everything looks healthy, members slip quietly. A daily scan catches attendance drops early — before the member has mentally checked out.`,
    stats: [
      { label: 'Active Members', value: a.activeMembers.length, emphasis: true },
      { label: 'Monthly Revenue', value: `${formatCurrency(a.totalMonthlyRevenue)}/mo` },
    ],
    trigger: { mode: 'cron', schedule: 'daily' },
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1).replace(/\.0$/, '')}k`
  }
  return `$${Math.round(amount)}`
}
