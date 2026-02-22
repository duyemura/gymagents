'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface ActionCard {
  id: string
  content: {
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
  approved: boolean | null
  dismissed: boolean | null
}

interface DashboardData {
  user: any
  gym: any
  tier: string
  autopilots: any[]
  recentRuns: any[]
  pendingActions: ActionCard[]
  monthlyRunCount: number
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<any>(null)
  const [actionStates, setActionStates] = useState<Record<string, 'pending' | 'approving' | 'approved' | 'dismissed'>>({})
  const [upgradeModal, setUpgradeModal] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState('')
  const upgraded = searchParams.get('upgraded')

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const dashData = await res.json()
      setData(dashData)
    } catch {}
    setLoading(false)
  }

  const runAutopilot = async () => {
    setRunning(true)
    setRunResult(null)
    try {
      const res = await fetch('/api/autopilot/run', { method: 'POST' })
      const result = await res.json()
      if (res.status === 403 && result.upgradeRequired) {
        setUpgradeModal(result.message)
      } else if (!res.ok) {
        setRunResult({ error: result.error })
      } else {
        setRunResult(result)
        await fetchDashboard()
      }
    } catch {
      setRunResult({ error: 'Something went wrong' })
    }
    setRunning(false)
  }

  const handleApprove = async (actionId: string) => {
    setActionStates(prev => ({ ...prev, [actionId]: 'approving' }))
    try {
      const res = await fetch('/api/autopilot/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId })
      })
      const result = await res.json()
      if (res.status === 403 && result.upgradeRequired) {
        setUpgradeModal(result.message)
        setActionStates(prev => ({ ...prev, [actionId]: 'pending' }))
      } else {
        setActionStates(prev => ({ ...prev, [actionId]: 'approved' }))
      }
    } catch {
      setActionStates(prev => ({ ...prev, [actionId]: 'pending' }))
    }
  }

  const handleDismiss = async (actionId: string) => {
    setActionStates(prev => ({ ...prev, [actionId]: 'dismissed' }))
    await fetch('/api/autopilot/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId })
    })
  }

  const handleCheckout = async (tier: string) => {
    setCheckoutLoading(tier)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier })
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {}
    setCheckoutLoading('')
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Loading your gym...</p>
        </div>
      </div>
    )
  }

  if (!data?.gym) {
    router.push('/connect')
    return null
  }

  const tierBadge = {
    free: <span className="badge-free">Free</span>,
    starter: <span className="badge-starter">Starter</span>,
    pro: <span className="badge-pro">Pro</span>
  }

  const allActions: ActionCard[] = [
    ...(data.pendingActions || []),
    ...(runResult?.output?.actions?.map((a: any, i: number) => ({
      id: `new-${i}`,
      content: a,
      approved: null,
      dismissed: null
    })) || [])
  ]

  const uniqueActions = allActions.filter((action, index, self) =>
    index === self.findIndex(a => a.content?.memberId === action.content?.memberId)
  )

  const autopilot = data.autopilots.find(a => a.skill_type === 'at_risk_detector')

  const skills = [
    {
      id: 'at_risk_detector',
      name: '🚨 At-Risk Member Detector',
      description: 'Finds members who are going quiet before they cancel',
      schedule: 'Daily scan',
      tier: 'free',
      active: true,
      lastRun: autopilot?.last_run_at,
      runCount: autopilot?.run_count || 0,
      approvalRate: autopilot?.approval_rate || 0
    },
    {
      id: 'lead_followup',
      name: '🎯 Lead Follow-Up Drafter',
      description: 'Drafts immediate responses to new leads while you coach',
      schedule: 'On new lead',
      tier: 'starter',
      active: false,
      teaser: 'Last week this would have followed up 5 new leads within 10 minutes'
    },
    {
      id: 'payment_failure',
      name: '💳 Payment Failure Alerter',
      description: 'Catches failed payments and drafts friendly recovery messages',
      schedule: 'Daily',
      tier: 'starter',
      active: false,
      teaser: 'Last month this would have caught 3 failed payments before they became cancellations'
    },
    {
      id: 'birthday_messenger',
      name: '🎂 Birthday & Milestone Messenger',
      description: 'Celebrates member anniversaries and milestones automatically',
      schedule: 'Daily',
      tier: 'pro',
      active: false,
      teaser: 'This week 2 members are hitting their 1-year anniversary'
    },
    {
      id: 'capacity_optimizer',
      name: '📊 Class Capacity Optimizer',
      description: 'Spots under-booked classes and recommends when to nudge members',
      schedule: 'Weekly',
      tier: 'pro',
      active: false,
      teaser: 'Your Tuesday 6pm class is running at 40% capacity consistently'
    },
    {
      id: 'revenue_alerter',
      name: '💰 Revenue Risk Alerter',
      description: 'Tracks billing health and flags revenue at risk before month end',
      schedule: 'Weekly',
      tier: 'pro',
      active: false,
      teaser: 'Would track payment trends across all members'
    }
  ]

  const monthlyLimit = data.tier === 'free' ? 3 : data.tier === 'starter' ? 30 : 9999
  const runsUsed = data.monthlyRunCount
  const runsRemaining = monthlyLimit - runsUsed

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <span className="font-bold text-gray-900">GymAgents</span>
            </Link>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600 text-sm font-medium">{data.gym.gym_name}</span>
            {tierBadge[data.tier as keyof typeof tierBadge]}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/settings" className="text-gray-500 hover:text-gray-900 text-sm">
              Settings
            </Link>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Welcome banner */}
        {upgraded && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="font-semibold text-green-800">You're on {data.tier === 'pro' ? 'Pro' : 'Starter'}!</p>
              <p className="text-green-700 text-sm">All autopilots are now unlocked. Run a scan to get started.</p>
            </div>
          </div>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card p-4">
            <div className="text-2xl font-bold text-gray-900">{data.gym.member_count}</div>
            <div className="text-xs text-gray-500 mt-1">Total members</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold text-violet-600">{uniqueActions.filter(a => !actionStates[a.id] || actionStates[a.id] === 'pending').length}</div>
            <div className="text-xs text-gray-500 mt-1">Actions waiting</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold text-gray-900">{data.tier === 'pro' ? '∞' : `${runsUsed}/${monthlyLimit}`}</div>
            <div className="text-xs text-gray-500 mt-1">Scans this month</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold text-green-500">{autopilot?.approval_rate || 0}%</div>
            <div className="text-xs text-gray-500 mt-1">Message approval rate</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main: Autopilot fleet */}
          <div className="lg:col-span-2 space-y-6">
            {/* Run button + status */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-gray-900 text-lg">Your Autopilot Fleet</h2>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {data.tier === 'free' && `${runsRemaining} free scans remaining this month`}
                    {data.tier === 'starter' && `${runsRemaining} scans remaining this month`}
                    {data.tier === 'pro' && 'Unlimited scans — running daily'}
                  </p>
                </div>
                <button
                  onClick={runAutopilot}
                  disabled={running || (data.tier === 'free' && runsUsed >= 3)}
                  className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm flex items-center gap-2"
                >
                  {running ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      Scanning...
                    </>
                  ) : '⚡ Run scan now'}
                </button>
              </div>

              {running && (
                <div className="bg-violet-50 rounded-lg p-4 text-sm text-violet-700 flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                  Your assistant is scanning {data.gym.member_count} members for churn signals...
                </div>
              )}

              {runResult?.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm mt-3">
                  {runResult.error}
                </div>
              )}

              {runResult?.output && !runResult.error && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-3">
                  <p className="text-green-800 font-semibold text-sm">✅ {runResult.output.summary}</p>
                  {runResult.output.gymInsight && (
                    <p className="text-green-700 text-xs mt-1">💡 {runResult.output.gymInsight}</p>
                  )}
                </div>
              )}
            </div>

            {/* Skill cards */}
            <div className="space-y-3">
              {skills.map(skill => (
                <div key={skill.id} className={`card p-5 ${!skill.active && skill.tier !== 'free' ? 'opacity-80' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 text-sm">{skill.name}</h3>
                        {skill.tier !== 'free' && (
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                            skill.tier === 'starter' ? 'bg-violet-100 text-violet-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {skill.tier === 'starter' ? 'Starter' : 'Pro'}
                          </span>
                        )}
                        {skill.active && (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs">{skill.description}</p>
                      {skill.lastRun && (
                        <p className="text-gray-400 text-xs mt-1">
                          Last run: {new Date(skill.lastRun).toLocaleDateString()} · {skill.runCount} total runs · {skill.approvalRate}% approval
                        </p>
                      )}
                      {skill.teaser && (
                        <p className="text-violet-600 text-xs mt-1 italic">💡 {skill.teaser}</p>
                      )}
                    </div>
                    <div>
                      {skill.active ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <div className="w-8 h-5 bg-green-500 rounded-full flex items-center justify-end pr-0.5">
                            <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if ((skill.tier === 'starter' && data.tier === 'free') ||
                                (skill.tier === 'pro' && (data.tier === 'free' || data.tier === 'starter'))) {
                              setUpgradeModal(`Upgrade to ${skill.tier === 'starter' ? 'Starter' : 'Pro'} to unlock ${skill.name}`)
                            }
                          }}
                          className="text-xs text-gray-400 hover:text-violet-600 font-medium border border-gray-200 px-3 py-1.5 rounded-lg hover:border-violet-300 transition-colors"
                        >
                          Unlock →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Action feed */}
          <div className="space-y-4">
            <div>
              <h2 className="font-bold text-gray-900 mb-1">Action Feed</h2>
              <p className="text-gray-500 text-sm">What your assistant found. Act on it.</p>
            </div>

            {uniqueActions.length === 0 ? (
              <div className="card p-6 text-center">
                <div className="text-4xl mb-3">🎯</div>
                <h3 className="font-semibold text-gray-900 mb-2">No actions yet</h3>
                <p className="text-gray-500 text-sm mb-4">
                  Run your first scan to see which members need attention.
                </p>
                <button
                  onClick={runAutopilot}
                  disabled={running}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Run first scan →
                </button>
              </div>
            ) : (
              uniqueActions.map(action => {
                const state = actionStates[action.id]
                if (state === 'dismissed') return null
                
                const content = action.content
                if (!content) return null

                const riskColors = {
                  high: 'border-red-200 bg-red-50',
                  medium: 'border-amber-200 bg-amber-50',
                  low: 'border-blue-200 bg-blue-50'
                }

                return (
                  <div key={action.id} className={`card border-l-4 ${
                    content.riskLevel === 'high' ? 'border-l-red-500' :
                    content.riskLevel === 'medium' ? 'border-l-amber-500' :
                    'border-l-blue-500'
                  } p-5`}>
                    {state === 'approved' ? (
                      <div className="text-center py-2">
                        <div className="text-2xl mb-1">✅</div>
                        <p className="text-green-700 font-semibold text-sm">Message sent to {content.memberName}!</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-bold text-gray-900 text-sm">{content.memberName}</div>
                            <div className="text-gray-500 text-xs">{content.memberEmail}</div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            content.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                            content.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {content.riskLevel?.toUpperCase()} RISK
                          </span>
                        </div>

                        <p className="text-gray-600 text-xs mb-3 leading-relaxed">{content.riskReason}</p>

                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                          <div className="text-xs font-semibold text-gray-500 mb-1">📝 Draft message</div>
                          <p className="text-gray-700 text-xs leading-relaxed">{content.draftedMessage}</p>
                        </div>

                        {data.tier === 'free' ? (
                          <div>
                            <button
                              onClick={() => setUpgradeModal('Upgrade to Starter to send messages with one click. Free tier is read-only.')}
                              className="w-full bg-violet-100 hover:bg-violet-200 text-violet-700 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                            >
                              🔒 Upgrade to send →
                            </button>
                            <p className="text-gray-400 text-xs text-center mt-1">Free tier: read-only recommendations</p>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(action.id)}
                              disabled={state === 'approving'}
                              className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-semibold px-3 py-2 rounded-lg text-xs transition-colors"
                            >
                              {state === 'approving' ? 'Sending...' : '✓ Send message'}
                            </button>
                            <button
                              onClick={() => handleDismiss(action.id)}
                              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium px-3 py-2 rounded-lg text-xs transition-colors"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </main>

      {/* Upgrade Modal */}
      {upgradeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl">
            <div className="text-4xl mb-4 text-center">⚡</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Unlock this feature</h2>
            <p className="text-gray-600 text-sm text-center mb-6">{upgradeModal}</p>
            
            <div className="space-y-3 mb-6">
              <div className="border border-violet-200 rounded-xl p-4 cursor-pointer hover:bg-violet-50 transition-colors" onClick={() => handleCheckout('starter')}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900">Starter — $49/month</div>
                    <div className="text-gray-500 text-sm">3 skills, 30 scans, one-click sending</div>
                  </div>
                  <div className="text-violet-600 font-bold">
                    {checkoutLoading === 'starter' ? '...' : '→'}
                  </div>
                </div>
              </div>
              <div className="border border-purple-200 rounded-xl p-4 cursor-pointer hover:bg-purple-50 transition-colors" onClick={() => handleCheckout('pro')}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900">Pro — $97/month</div>
                    <div className="text-gray-500 text-sm">6 skills, unlimited scans, auto-send</div>
                  </div>
                  <div className="text-purple-500 font-bold">
                    {checkoutLoading === 'pro' ? '...' : '→'}
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-gray-400 text-xs text-center mb-4">14-day free trial on all paid plans</p>
            
            <button
              onClick={() => setUpgradeModal(null)}
              className="w-full text-gray-500 hover:text-gray-700 text-sm font-medium py-2"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>}>
      <DashboardContent />
    </Suspense>
  )
}
