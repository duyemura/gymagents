'use client'

import { useEffect, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Suggestion {
  id: string
  title: string
  description: string
  proposed_change: {
    content: string
    category?: string
    importance?: number
    scope?: string
    memberId?: string
    targetMemoryId?: string
  }
  evidence: string | null
  confidence_score: number
  evidence_strength: string | null
  created_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function ConfidenceBar({ score }: { score: number }) {
  const color = score >= 80 ? '#16A34A' : score >= 60 ? '#0063FF' : '#9CA3AF'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-gray-100">
        <div className="h-1 transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-semibold tabular-nums" style={{ color }}>{score}%</span>
    </div>
  )
}

function EvidenceBadge({ strength }: { strength: string | null }) {
  if (!strength) return null
  const styles: Record<string, { bg: string; color: string }> = {
    strong:   { bg: '#F0FDF4', color: '#16A34A' },
    moderate: { bg: '#EFF6FF', color: '#0063FF' },
    weak:     { bg: '#F9FAFB', color: '#9CA3AF' },
  }
  const s = styles[strength] ?? styles.weak
  return (
    <span
      className="text-[10px] font-semibold tracking-widest uppercase px-1.5 py-0.5"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {strength} signal
    </span>
  )
}

// ── Suggestion Card ────────────────────────────────────────────────────────────

function SuggestionCard({ suggestion, onApply, onDismiss }: {
  suggestion: Suggestion
  onApply: (id: string) => Promise<void>
  onDismiss: (id: string) => Promise<void>
}) {
  const [acting, setActing] = useState<'apply' | 'dismiss' | null>(null)
  const [confirming, setConfirming] = useState(false)

  const handleApply = async () => {
    setActing('apply')
    await onApply(suggestion.id)
  }

  const handleDismiss = async () => {
    if (!confirming) { setConfirming(true); return }
    setActing('dismiss')
    await onDismiss(suggestion.id)
  }

  const change = suggestion.proposed_change

  return (
    <div className="border border-gray-100 bg-white">
      {/* Confidence bar — top edge */}
      <div
        className="h-0.5"
        style={{
          backgroundColor: suggestion.confidence_score >= 80 ? '#16A34A'
            : suggestion.confidence_score >= 60 ? '#0063FF'
            : '#E5E7EB'
        }}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-sm font-semibold text-gray-900">{suggestion.title}</span>
              <EvidenceBadge strength={suggestion.evidence_strength} />
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{suggestion.description}</p>
          </div>
        </div>

        {/* Proposed change */}
        <div className="mb-3 bg-gray-50 px-3 py-2 border-l-2 border-gray-300">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-400 mb-1">Proposed change</p>
          <p className="text-xs text-gray-800 leading-relaxed">{change?.content ?? JSON.stringify(change)}</p>
          {change?.category && (
            <p className="text-[10px] text-gray-400 mt-1">
              Category: {change.category}
              {change.scope && change.scope !== 'global' ? ` · Scope: ${change.scope}` : ''}
              {change.importance ? ` · Importance: ${change.importance}/5` : ''}
            </p>
          )}
        </div>

        {/* Evidence */}
        {suggestion.evidence && (
          <div className="mb-3">
            <p className="text-[10px] font-semibold tracking-widets uppercase text-gray-400 mb-0.5">Evidence</p>
            <p className="text-xs text-gray-500 leading-relaxed italic">"{suggestion.evidence}"</p>
          </div>
        )}

        {/* Confidence */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-400 mb-1">Confidence</p>
          <ConfidenceBar score={suggestion.confidence_score} />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">
            {new Date(suggestion.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDismiss}
              disabled={acting !== null}
              className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 transition-colors disabled:opacity-40"
            >
              {acting === 'dismiss' ? 'Dismissing…' : confirming ? 'Sure?' : 'Dismiss'}
            </button>
            <button
              onClick={handleApply}
              disabled={acting !== null}
              className="text-xs font-semibold text-white px-3 py-1.5 transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: '#0063FF' }}
            >
              {acting === 'apply' ? 'Applying…' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-8">
      <div
        className="w-10 h-10 flex items-center justify-center mb-4"
        style={{ backgroundColor: '#F3F4F6' }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 3l1.8 5.4H17l-4.6 3.3 1.8 5.4L10 14l-4.2 3.1 1.8-5.4L3 8.4h5.2L10 3z" stroke="#9CA3AF" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-700 mb-1">No improvements yet</p>
      <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
        As agents handle conversations and tasks, they'll surface suggestions here — things they notice about your business, your members, and what works.
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ImprovementsPanel() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSuggestions = () => {
    fetch('/api/improvements')
      .then(r => r.json())
      .then(json => { setSuggestions(json.suggestions ?? []); setLoading(false) })
      .catch(() => { setError('Failed to load improvements'); setLoading(false) })
  }

  useEffect(() => { fetchSuggestions() }, [])

  const handleApply = async (id: string) => {
    const res = await fetch('/api/improvements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'apply' }),
    })
    if (res.ok) setSuggestions(prev => prev.filter(s => s.id !== id))
  }

  const handleDismiss = async (id: string) => {
    const res = await fetch('/api/improvements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'dismiss' }),
    })
    if (res.ok) setSuggestions(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="overflow-y-auto flex-1">
      <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Improvements</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Suggestions from your agents — things learned from conversations, edits, and outcomes. Apply to update your memories and preferences.
          </p>
        </div>
        {suggestions.length > 0 && (
          <span
            className="text-[10px] font-bold tabular-nums px-2 py-0.5 flex-shrink-0 mt-1"
            style={{ backgroundColor: '#0063FF', color: 'white' }}
          >
            {suggestions.length}
          </span>
        )}
      </div>

      <div className="px-6 py-6">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="w-3 h-3 border border-gray-300 border-t-blue-500 animate-spin" style={{ borderRadius: '50%' }} />
            Loading…
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        {!loading && !error && suggestions.length === 0 && <EmptyState />}

        {!loading && !error && suggestions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestions.map(s => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                onApply={handleApply}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
