'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AgentPromptBuilder from '@/components/AgentPromptBuilder'

// ── Types ────────────────────────────────────────────────────────────────────

interface RecommendationStat {
  label: string
  value: string | number
  emphasis?: boolean
}

interface Recommendation {
  agentType: string
  name: string
  description: string
  headline: string
  reasoning: string
  stats: RecommendationStat[]
  trigger: {
    mode: 'cron' | 'event'
    schedule?: string
    event?: string
  }
}

// ── Schedule options ─────────────────────────────────────────────────────────

const TRIGGER_OPTIONS = [
  { id: 'daily', label: 'Daily', description: 'Every morning', mode: 'cron', schedule: 'daily' },
  { id: 'weekly', label: 'Weekly', description: 'Every Monday', mode: 'cron', schedule: 'weekly' },
  { id: 'event', label: 'On Event', description: 'Something happens in PushPress', mode: 'event', schedule: null },
  { id: 'manual', label: 'Manual', description: 'You run it yourself', mode: 'manual', schedule: null },
]

const PUSHPRESS_EVENTS = [
  { value: 'member.cancelled', label: 'Member cancelled' },
  { value: 'lead.created', label: 'New lead submitted' },
  { value: 'member.created', label: 'New member signed up' },
  { value: 'payment.failed', label: 'Payment failed' },
  { value: 'checkin.created', label: 'Member checked in' },
]

// ── Progress ─────────────────────────────────────────────────────────────────

function Progress({ step }: { step: number }) {
  const labels = ['Build', 'Schedule']
  return (
    <div className="flex items-center gap-0 mb-10">
      {labels.map((label, i) => {
        const s = i + 1
        const active = step === s
        const done = step > s
        return (
          <div key={s} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <div
                className="w-5 h-5 flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{
                  backgroundColor: done ? '#0063FF' : active ? '#080808' : '#E5E7EB',
                  color: done || active ? 'white' : '#9CA3AF',
                }}
              >
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : s}
              </div>
              <span className="text-xs font-medium" style={{ color: active ? '#080808' : done ? '#0063FF' : '#9CA3AF' }}>
                {label}
              </span>
            </div>
            {s < 2 && <div className="w-8 h-px mx-2" style={{ backgroundColor: step > s ? '#0063FF' : '#E5E7EB' }} />}
          </div>
        )
      })}
    </div>
  )
}

// ── Loading animation ────────────────────────────────────────────────────────

const LOADING_MESSAGES = [
  'Connecting to your PushPress data…',
  'Analyzing member attendance patterns…',
  'Looking at payment history…',
  'Identifying opportunities…',
  'Building your recommendation…',
]

function LoadingScreen() {
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8F9FB' }}>
      <div className="text-center max-w-sm w-full">
        {/* Animated pulse icon */}
        <div className="relative w-12 h-12 mx-auto mb-6">
          <div
            className="absolute inset-0 animate-ping opacity-20"
            style={{ backgroundColor: '#0063FF' }}
          />
          <div
            className="relative w-12 h-12 flex items-center justify-center"
            style={{ backgroundColor: '#0063FF' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-2">
          Learning your business
        </h2>
        <p
          className="text-sm transition-opacity duration-500"
          style={{ color: '#6B7280' }}
          key={msgIndex}
        >
          {LOADING_MESSAGES[msgIndex]}
        </p>
      </div>
    </div>
  )
}

// ── Recommendation card ──────────────────────────────────────────────────────

function RecommendationCard({
  rec,
  accountName,
  onAccept,
  onCustomize,
  onSkip,
}: {
  rec: Recommendation
  accountName: string
  onAccept: () => void
  onCustomize: () => void
  onSkip: () => void
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F9FB' }}>
      <header className="h-12 bg-white border-b border-gray-100 flex items-center px-6 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center" style={{ backgroundColor: '#0063FF' }}>
            <span className="font-bold text-[10px] text-white">G</span>
          </div>
          <span className="font-semibold text-sm text-gray-900">GymAgents</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={onSkip}
          className="text-xs transition-colors"
          style={{ color: '#9CA3AF' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#6B7280')}
          onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
        >
          Skip for now
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-xl">
          {/* Header */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-400 mb-2">
              RECOMMENDED FOR {accountName.toUpperCase()}
            </p>
            <h1 className="text-xl font-bold text-gray-900 mb-2">{rec.headline}</h1>
            <p className="text-sm" style={{ color: '#6B7280' }}>{rec.reasoning}</p>
          </div>

          {/* Stats */}
          <div className="flex gap-3 mb-8">
            {rec.stats.map((stat, i) => (
              <div
                key={i}
                className="flex-1 border p-4 bg-white"
                style={{ borderColor: stat.emphasis ? '#0063FF' : '#E5E7EB' }}
              >
                <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-400 mb-1">
                  {stat.label}
                </p>
                <p
                  className="text-lg font-bold"
                  style={{ color: stat.emphasis ? '#0063FF' : '#111827' }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Agent preview card */}
          <div className="bg-white border border-gray-200 p-6 mb-6">
            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: '#0063FF' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 1 0 10 10H12V2Z" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">{rec.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{rec.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100">
              <span className="text-[10px] font-semibold tracking-widest uppercase text-gray-400">
                RUNS
              </span>
              <span className="text-xs text-gray-700">
                {rec.trigger.mode === 'cron'
                  ? `${rec.trigger.schedule === 'daily' ? 'Every morning' : 'Weekly'}`
                  : `When ${PUSHPRESS_EVENTS.find(e => e.value === rec.trigger.event)?.label.toLowerCase() || 'event fires'}`
                }
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={onAccept}
              className="w-full py-3 text-sm font-bold text-white transition-opacity"
              style={{ backgroundColor: '#0063FF' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Start with this agent →
            </button>
            <button
              onClick={onCustomize}
              className="w-full py-3 text-sm font-medium border border-gray-200 bg-white transition-colors hover:bg-gray-50"
              style={{ color: '#6B7280' }}
            >
              I'll customize it first
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'loading-error' | 'recommendation' | 'build' | 'done'

export default function SetupPage() {
  const router = useRouter()

  // Phase state
  const [phase, setPhase] = useState<Phase>('loading')
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [accountName, setAccountName] = useState('')
  const [loadError, setLoadError] = useState('')
  const [fromRecommendation, setFromRecommendation] = useState(false)

  // Step 1 — build
  const [agentName, setAgentName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')

  // Step 2 — schedule
  const [selectedTrigger, setSelectedTrigger] = useState('daily')
  const [selectedEvent, setSelectedEvent] = useState('member.cancelled')
  const [runHour, setRunHour] = useState(9)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [step, setStep] = useState(1)

  const fieldCls = 'w-full text-sm border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:border-blue-400 transition-colors'
  const labelCls = 'text-[10px] font-semibold tracking-widest uppercase text-gray-400 mb-1 block'

  // ── Fetch recommendation ────────────────────────────────────────────────────

  const fetchRecommendation = async () => {
    setPhase('loading')
    setLoadError('')

    try {
      const res = await fetch('/api/setup/recommend', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to analyze (${res.status})`)
      }
      const { recommendation: rec, snapshotSummary } = await res.json()

      setRecommendation(rec)
      setAccountName(snapshotSummary?.accountName || 'Your Gym')
      setPhase('recommendation')
    } catch (err: any) {
      console.error('[setup] recommendation fetch failed:', err)
      setLoadError(err.message)
      // Show error on loading screen — user can retry or skip
      setPhase('loading-error')
    }
  }

  useEffect(() => {
    fetchRecommendation()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Accept recommendation → go straight to schedule ────────────────────────

  const handleAcceptRecommendation = () => {
    if (!recommendation) return

    setAgentName(recommendation.name)
    setDescription(recommendation.description)
    // Don't set system prompt — let AI generate it based on name + description
    setSystemPrompt('')

    // Pre-select the trigger
    if (recommendation.trigger.mode === 'event' && recommendation.trigger.event) {
      setSelectedTrigger('event')
      setSelectedEvent(recommendation.trigger.event)
    } else if (recommendation.trigger.schedule === 'weekly') {
      setSelectedTrigger('weekly')
    } else {
      setSelectedTrigger('daily')
    }

    setStep(2)
    setPhase('build')
  }

  // ── Customize → go to build with pre-filled fields ─────────────────────────

  const handleCustomize = () => {
    if (recommendation) {
      setAgentName(recommendation.name)
      setDescription(recommendation.description)
      setFromRecommendation(true)

      if (recommendation.trigger.mode === 'event' && recommendation.trigger.event) {
        setSelectedTrigger('event')
        setSelectedEvent(recommendation.trigger.event)
      } else if (recommendation.trigger.schedule === 'weekly') {
        setSelectedTrigger('weekly')
      } else {
        setSelectedTrigger('daily')
      }
    }

    setStep(1)
    setPhase('build')
  }

  // ── Create agent ───────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!agentName.trim()) return

    // If no system prompt, generate one first
    if (!systemPrompt.trim()) {
      setCreating(true)
      setCreateError('')
      try {
        const genRes = await fetch('/api/agents/generate-variations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: agentName, description }),
        })
        const genData = await genRes.json()
        if (genRes.ok && genData.variations?.length > 0) {
          // Use the first variation
          await deployAgent(genData.variations[0].prompt)
        } else {
          // Use a basic prompt
          await deployAgent(`You are ${agentName}. ${description}`)
        }
      } catch (err: any) {
        setCreateError(err.message)
        setCreating(false)
      }
      return
    }

    setCreating(true)
    setCreateError('')
    await deployAgent(systemPrompt.trim())
  }

  const deployAgent = async (prompt: string) => {
    try {
      const trigger = TRIGGER_OPTIONS.find(t => t.id === selectedTrigger)!
      const skillType = agentName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 40) || 'custom_agent'

      const config = {
        name: agentName,
        description: description.trim(),
        skill_type: skillType,
        system_prompt: prompt,
        trigger_mode: trigger.mode === 'manual' ? 'cron' : trigger.mode,
        trigger_event: trigger.mode === 'event' ? selectedEvent : null,
        cron_schedule: trigger.mode === 'cron' ? trigger.schedule : null,
        run_hour: runHour,
        action_type: 'draft_message',
        data_sources: [],
      }

      const res = await fetch('/api/agent-builder/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create agent')

      setPhase('done')
      setTimeout(() => router.push('/dashboard'), 1800)
    } catch (err: any) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  // ── Render: Loading ────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return <LoadingScreen />
  }

  // ── Render: Loading error ──────────────────────────────────────────────────

  if (phase === 'loading-error') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8F9FB' }}>
        <div className="text-center max-w-sm w-full">
          <div
            className="w-12 h-12 flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: '#F3F4F6' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Couldn't analyze your data</h2>
          <p className="text-sm text-gray-500 mb-2">{loadError}</p>
          <p className="text-xs text-gray-400 mb-6">Check the terminal for more details.</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={fetchRecommendation}
              className="w-full py-3 text-sm font-bold text-white transition-opacity"
              style={{ backgroundColor: '#0063FF' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Try again
            </button>
            <button
              onClick={() => setPhase('build')}
              className="w-full py-3 text-sm font-medium border border-gray-200 bg-white transition-colors hover:bg-gray-50"
              style={{ color: '#6B7280' }}
            >
              Set up manually instead
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-xs mt-2 transition-colors"
              style={{ color: '#9CA3AF' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#6B7280')}
              onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: Recommendation ─────────────────────────────────────────────────

  if (phase === 'recommendation' && recommendation) {
    return (
      <RecommendationCard
        rec={recommendation}
        accountName={accountName}
        onAccept={handleAcceptRecommendation}
        onCustomize={handleCustomize}
        onSkip={() => router.push('/dashboard')}
      />
    )
  }

  // ── Render: Done ───────────────────────────────────────────────────────────

  if (phase === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8F9FB' }}>
        <div className="bg-white border border-gray-100 p-12 text-center max-w-sm w-full">
          <div className="w-10 h-10 flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#0063FF' }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M4 10l4 4 8-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Agent created</h2>
          <p className="text-sm text-gray-400">Taking you to your dashboard…</p>
        </div>
      </div>
    )
  }

  // ── Render: Build flow ─────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F9FB' }}>
      <header className="h-12 bg-white border-b border-gray-100 flex items-center px-6 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center" style={{ backgroundColor: '#0063FF' }}>
            <span className="font-bold text-[10px] text-white">G</span>
          </div>
          <span className="font-semibold text-sm text-gray-900">GymAgents</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => router.push('/dashboard')}
          className="text-xs transition-colors"
          style={{ color: '#9CA3AF' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#6B7280')}
          onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
        >
          Skip for now
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-xl">
          <Progress step={step} />

          {/* ── Step 1: Build ───────────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900 mb-1">Build your first agent</h1>
                <p className="text-sm text-gray-400">Name it, describe what it does, and let the AI write the prompt.</p>
              </div>

              <AgentPromptBuilder
                name={agentName}
                description={description}
                systemPrompt={systemPrompt}
                onNameChange={setAgentName}
                onDescriptionChange={setDescription}
                onSystemPromptChange={setSystemPrompt}
                descriptionPlaceholder="e.g. Find members who haven't checked in for 2+ weeks and draft a personal check-in message."
                autoGenerate={fromRecommendation}
              />

              <div className="mt-6">
                <button
                  onClick={() => setStep(2)}
                  disabled={!agentName.trim()}
                  className="w-full py-3 text-sm font-bold text-white transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: '#0063FF' }}
                  onMouseEnter={e => { if (agentName.trim()) (e.currentTarget as HTMLButtonElement).style.opacity = '0.8' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                >
                  Next: Set a schedule →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Schedule ────────────────────────────────────────── */}
          {step === 2 && (
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">When should it run?</h1>
              <p className="text-sm text-gray-400 mb-6">You can change this any time from your dashboard.</p>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {TRIGGER_OPTIONS.map(t => {
                  const active = selectedTrigger === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTrigger(t.id)}
                      className="text-left p-4 border transition-colors"
                      style={{
                        backgroundColor: active ? '#F0F6FF' : 'white',
                        borderColor: active ? '#0063FF' : '#E5E7EB',
                      }}
                    >
                      <p className="text-sm font-bold mb-0.5" style={{ color: active ? '#0063FF' : '#111827' }}>
                        {t.label}
                      </p>
                      <p className="text-xs text-gray-400">{t.description}</p>
                    </button>
                  )
                })}
              </div>

              {(selectedTrigger === 'daily' || selectedTrigger === 'weekly') && (
                <div className="mb-4">
                  <label className={labelCls}>Run at (UTC)</label>
                  <select
                    value={runHour}
                    onChange={e => setRunHour(Number(e.target.value))}
                    className={fieldCls + ' bg-white'}
                  >
                    {Array.from({ length: 24 }, (_, i) => {
                      const label = i === 0 ? '12:00 AM' : i === 12 ? '12:00 PM' : i < 12 ? `${i}:00 AM` : `${i - 12}:00 PM`
                      return <option key={i} value={i}>{label}</option>
                    })}
                  </select>
                </div>
              )}

              {selectedTrigger === 'event' && (
                <div className="mb-4">
                  <label className={labelCls}>Which event triggers this agent?</label>
                  <select
                    value={selectedEvent}
                    onChange={e => setSelectedEvent(e.target.value)}
                    className={fieldCls + ' bg-white'}
                  >
                    {PUSHPRESS_EVENTS.map(ev => (
                      <option key={ev.value} value={ev.value}>{ev.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {createError && <p className="text-xs text-red-500 mb-3">{createError}</p>}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-3 text-sm font-medium border border-gray-200 bg-white transition-colors hover:bg-gray-50"
                  style={{ color: '#6B7280' }}
                >
                  ← Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: '#0063FF' }}
                  onMouseEnter={e => { if (!creating) (e.currentTarget as HTMLButtonElement).style.opacity = '0.8' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                >
                  {creating ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating…
                    </span>
                  ) : 'Create agent →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
