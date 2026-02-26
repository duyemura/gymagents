'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// ── Question options ──────────────────────────────────────────────────────────

const TARGET_OPTIONS = [
  { id: 'drifting', label: 'Drifting members', description: "Attendance is dropping" },
  { id: 'cancelled', label: 'Cancelled members', description: "Want them back" },
  { id: 'failed_payment', label: 'Failed payments', description: "Billing needs fixing" },
  { id: 'new_members', label: 'New members', description: "Just joined" },
  { id: 'new_leads', label: 'New leads', description: "Haven't joined yet" },
  { id: 'everyone', label: 'All active members', description: "Broad outreach" },
]

const TONE_OPTIONS = [
  { id: 'warm', label: 'Warm & Personal', description: "Coach who knows them" },
  { id: 'motivational', label: 'Motivational', description: "Push them to show up" },
  { id: 'direct', label: 'Direct & Brief', description: "Gets to the point" },
  { id: 'professional', label: 'Professional', description: "Business-appropriate" },
]

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

// ── Progress ──────────────────────────────────────────────────────────────────

function Progress({ step }: { step: number }) {
  const labels = ['Describe', 'Review', 'Schedule']
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
            {s < 3 && <div className="w-8 h-px mx-2" style={{ backgroundColor: step > s ? '#0063FF' : '#E5E7EB' }} />}
          </div>
        )
      })}
    </div>
  )
}

// ── Tile button ───────────────────────────────────────────────────────────────

function Tile({
  label, description, active, onClick,
}: { label: string; description: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left p-3 border transition-colors"
      style={{
        backgroundColor: active ? '#F0F6FF' : 'white',
        borderColor: active ? '#0063FF' : '#E5E7EB',
        borderLeft: active ? '3px solid #0063FF' : '3px solid transparent',
      }}
    >
      <p className="text-sm font-semibold" style={{ color: active ? '#0063FF' : '#111827' }}>{label}</p>
      <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{description}</p>
    </button>
  )
}

// ── Blinking cursor ───────────────────────────────────────────────────────────

function Cursor() {
  return (
    <span
      className="inline-block w-0.5 h-4 ml-0.5 animate-pulse align-middle"
      style={{ backgroundColor: '#0063FF', verticalAlign: 'middle' }}
    />
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter()

  // Step 1 — questions
  const [goal, setGoal] = useState('')
  const [target, setTarget] = useState('')
  const [tone, setTone] = useState('')
  const [successMetric, setSuccessMetric] = useState('')

  // Step 2 — generation
  const [agentName, setAgentName] = useState('')
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamDone, setStreamDone] = useState(false)
  const [genError, setGenError] = useState('')
  const generationRef = useRef(false)

  // Step 3 — schedule
  const [selectedTrigger, setSelectedTrigger] = useState('daily')
  const [selectedEvent, setSelectedEvent] = useState('member.cancelled')
  const [runHour, setRunHour] = useState(9)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [done, setDone] = useState(false)

  const [step, setStep] = useState(1)

  const labelCls = 'text-[10px] font-semibold tracking-widest uppercase text-gray-400 mb-2 block'
  const fieldCls = 'w-full text-sm border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:border-blue-400 transition-colors'

  // ── Generation ──────────────────────────────────────────────────────────────

  const runGeneration = async () => {
    if (generationRef.current) return
    generationRef.current = true
    setGeneratedPrompt('')
    setStreamDone(false)
    setGenError('')

    // Derive agent name from goal (quick slug) — replaced by API call below
    const quickName = goal.trim().split(' ').slice(0, 5).join(' ')
    setAgentName(quickName)

    // Fire name generation in parallel
    fetch('/api/setup/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, skillType: target }),
    })
      .then(r => r.json())
      .then(data => { if (data.config?.name) setAgentName(data.config.name) })
      .catch(() => {})

    // Stream the system prompt
    try {
      const res = await fetch('/api/setup/generate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, target, tone, successMetric }),
      })

      if (!res.ok || !res.body) {
        setGenError('Failed to generate — try again')
        setStreaming(false)
        generationRef.current = false
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done: readerDone, value } = await reader.read()
        if (readerDone) break
        accumulated += decoder.decode(value, { stream: true })
        setGeneratedPrompt(accumulated)
      }

      setStreamDone(true)
    } catch (err: any) {
      setGenError(err.message ?? 'Generation failed')
    } finally {
      setStreaming(false)
      generationRef.current = false
    }
  }

  const handleGenerate = () => {
    if (!goal.trim() || !target || !tone) return
    setStep(2)
    setStreaming(true)
  }

  // Trigger generation when step 2 becomes active
  useEffect(() => {
    if (step === 2 && streaming) {
      runGeneration()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, streaming])

  const handleRegenerate = () => {
    generationRef.current = false
    setStreaming(true)
    runGeneration()
  }

  // ── Create agent ────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!generatedPrompt.trim() || !agentName.trim()) return
    setCreating(true)
    setCreateError('')

    try {
      const trigger = TRIGGER_OPTIONS.find(t => t.id === selectedTrigger)!
      const skillType = goal.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 40)

      const config = {
        name: agentName,
        description: goal.trim(),
        skill_type: skillType || 'custom_agent',
        system_prompt: generatedPrompt.trim(),
        trigger_mode: trigger.mode === 'manual' ? 'cron' : trigger.mode,
        trigger_event: trigger.mode === 'event' ? selectedEvent : null,
        cron_schedule: trigger.mode === 'cron' ? trigger.schedule : null,
        run_hour: runHour,
        action_type: 'draft_message',
        data_sources: [],
        estimated_value: successMetric || '',
      }

      const res = await fetch('/api/agent-builder/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create agent')

      setDone(true)
      setTimeout(() => router.push('/dashboard'), 1800)
    } catch (err: any) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  // ── Done ────────────────────────────────────────────────────────────────────

  if (done) {
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

  // ── Layout ──────────────────────────────────────────────────────────────────

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

          {/* ── Step 1: Questions ───────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-7">
              <div>
                <h1 className="text-xl font-bold text-gray-900 mb-1">Build your first agent</h1>
                <p className="text-sm text-gray-400">Answer a few questions — the AI writes the prompt for you.</p>
              </div>

              {/* Goal */}
              <div>
                <label className={labelCls}>What should this agent do?</label>
                <textarea
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  rows={2}
                  placeholder="e.g. Find members who haven't been in for 2+ weeks and draft a personal check-in message for each one."
                  className={fieldCls + ' resize-none'}
                />
              </div>

              {/* Target */}
              <div>
                <label className={labelCls}>Who should it watch?</label>
                <div className="grid grid-cols-2 gap-2">
                  {TARGET_OPTIONS.map(opt => (
                    <Tile
                      key={opt.id}
                      label={opt.label}
                      description={opt.description}
                      active={target === opt.id}
                      onClick={() => setTarget(opt.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Tone */}
              <div>
                <label className={labelCls}>How should it communicate?</label>
                <div className="grid grid-cols-2 gap-2">
                  {TONE_OPTIONS.map(opt => (
                    <Tile
                      key={opt.id}
                      label={opt.label}
                      description={opt.description}
                      active={tone === opt.id}
                      onClick={() => setTone(opt.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Success metric */}
              <div>
                <label className={labelCls}>
                  What does success look like?
                  <span className="text-gray-300 normal-case font-normal tracking-normal ml-1">(optional)</span>
                </label>
                <input
                  type="text"
                  value={successMetric}
                  onChange={e => setSuccessMetric(e.target.value)}
                  placeholder="e.g. They come back to the gym. Payment gets fixed. Lead books a trial."
                  className={fieldCls}
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={!goal.trim() || !target || !tone}
                className="w-full py-3 text-sm font-bold text-white transition-opacity disabled:opacity-40"
                style={{ backgroundColor: '#0063FF' }}
                onMouseEnter={e => { if (goal.trim() && target && tone) (e.currentTarget as HTMLButtonElement).style.opacity = '0.8' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
              >
                Write my agent prompt →
              </button>
            </div>
          )}

          {/* ── Step 2: AI writes the prompt ────────────────────────────────── */}
          {step === 2 && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900 mb-1">
                  {streamDone ? 'Review your agent' : 'Writing your agent…'}
                </h1>
                <p className="text-sm text-gray-400">
                  {streamDone
                    ? 'Edit the prompt if you want, then set a schedule.'
                    : 'The AI is writing your agent prompt based on your answers.'}
                </p>
              </div>

              {/* Agent name */}
              <div className="mb-5">
                <label className={labelCls}>Agent name</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={e => setAgentName(e.target.value)}
                  className={fieldCls}
                  placeholder="Agent name"
                />
              </div>

              {/* Streaming prompt display */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls} style={{ marginBottom: 0 }}>Agent instructions</label>
                  {streamDone && (
                    <button
                      onClick={handleRegenerate}
                      className="text-[10px] font-semibold tracking-widest uppercase transition-colors"
                      style={{ color: '#9CA3AF' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#0063FF')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                    >
                      Regenerate
                    </button>
                  )}
                </div>

                {!streamDone ? (
                  /* Streaming view */
                  <div
                    className="w-full border border-gray-200 bg-white px-4 py-3 text-sm leading-relaxed font-mono min-h-[140px]"
                    style={{ color: '#374151' }}
                  >
                    {generatedPrompt}
                    <Cursor />
                  </div>
                ) : (
                  /* Editable after completion */
                  <textarea
                    value={generatedPrompt}
                    onChange={e => setGeneratedPrompt(e.target.value)}
                    rows={8}
                    className={fieldCls + ' resize-y font-mono text-xs leading-relaxed'}
                  />
                )}
              </div>

              {genError && <p className="text-xs text-red-500 mb-3">{genError}</p>}

              <div className="flex gap-2">
                <button
                  onClick={() => { setStep(1); generationRef.current = false }}
                  className="px-4 py-3 text-sm font-medium border border-gray-200 bg-white transition-colors hover:bg-gray-50"
                  style={{ color: '#6B7280' }}
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!streamDone || !generatedPrompt.trim()}
                  className="flex-1 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: '#0063FF' }}
                  onMouseEnter={e => { if (streamDone) (e.currentTarget as HTMLButtonElement).style.opacity = '0.8' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Schedule ────────────────────────────────────────────── */}
          {step === 3 && (
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
                  onClick={() => setStep(2)}
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
