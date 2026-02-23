'use client'

import { useState } from 'react'

export interface GMAgentPanelProps {
  lastRunAt?: string | null
  insightsFound?: number
  activeMembers?: number
  churnRiskCount?: number
  revenueMtd?: number
  onRunAnalysis?: () => void
  isRunning?: boolean
  recentRuns?: Array<{ id: string; created_at: string; insights_generated: number }>
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function formatRunLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
  if (diffDays === 0) return `Today ${t}`
  if (diffDays === 1) return `Yesterday ${t}`
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${t}`
}

const DEMO_RECENT_RUNS = [
  { id: 'dr1', created_at: new Date(Date.now() - 2 * 3_600_000).toISOString(), insights_generated: 3 },
  { id: 'dr2', created_at: new Date(Date.now() - 27 * 3_600_000).toISOString(), insights_generated: 1 },
  { id: 'dr3', created_at: new Date(Date.now() - 4 * 86_400_000).toISOString(), insights_generated: 6 },
]

export default function GMAgentPanel({
  lastRunAt,
  insightsFound = 0,
  activeMembers,
  churnRiskCount,
  revenueMtd,
  onRunAnalysis,
  isRunning = false,
  recentRuns,
}: GMAgentPanelProps) {
  const [runsOpen, setRunsOpen] = useState(false)
  const runs = recentRuns && recentRuns.length > 0 ? recentRuns : DEMO_RECENT_RUNS
  const lastRun = lastRunAt ?? runs[0]?.created_at ?? null

  return (
    <div className="border-b border-gray-100">
      {/* ── Header row ── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: '#22C55E' }}
            />
            <span className="text-sm font-semibold text-gray-900">GM Agent</span>
            <span className="text-[10px] font-semibold" style={{ color: '#22C55E' }}>Active</span>
          </div>
          <button
            onClick={onRunAnalysis}
            disabled={isRunning}
            className="text-[10px] font-semibold text-white px-2.5 py-1 transition-opacity hover:opacity-80 disabled:opacity-50 flex items-center gap-1"
            style={{ backgroundColor: '#0063FF' }}
          >
            {isRunning && (
              <span
                className="w-2 h-2 rounded-full border border-white border-t-transparent animate-spin"
                style={{ borderTopColor: 'transparent' }}
              />
            )}
            {isRunning ? 'Running…' : 'Run Analysis'}
          </button>
        </div>

        {/* Summary line */}
        <p className="text-xs text-gray-400 mt-1.5">
          {lastRun
            ? `Last analysis: ${timeAgo(lastRun)} · Found ${insightsFound} insight${insightsFound !== 1 ? 's' : ''}`
            : 'No analysis run yet'}
        </p>
      </div>

      {/* ── Stats row ── */}
      {(activeMembers !== undefined || churnRiskCount !== undefined || revenueMtd !== undefined) && (
        <div className="grid grid-cols-3 border-t border-gray-100">
          {[
            { label: 'Members', value: activeMembers !== undefined ? activeMembers.toLocaleString() : '—' },
            { label: 'Churn Risk', value: churnRiskCount !== undefined ? String(churnRiskCount) : '—' },
            { label: 'MRR', value: revenueMtd !== undefined ? `$${Math.round(revenueMtd / 1000)}k` : '—' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="px-3 py-2.5 flex flex-col"
              style={{ borderRight: i < 2 ? '1px solid #F3F4F6' : 'none' }}
            >
              <span className="text-[10px] text-gray-400 uppercase tracking-widest">{stat.label}</span>
              <span className="text-sm font-semibold text-gray-900 mt-0.5">{stat.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Activity feed ── */}
      <div className="border-t border-gray-100">
        <button
          className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors"
          onClick={() => setRunsOpen(v => !v)}
        >
          <span className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">Recent runs</span>
          <span className="text-[10px] text-gray-300">{runsOpen ? '▲' : '▼'}</span>
        </button>
        {runsOpen && (
          <div className="pb-2">
            {runs.slice(0, 5).map(run => (
              <div key={run.id} className="flex items-center justify-between px-4 py-1.5">
                <span className="text-xs text-gray-500">{formatRunLabel(run.created_at)}</span>
                <span className={`text-xs font-medium ${run.insights_generated > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                  {run.insights_generated > 0
                    ? `${run.insights_generated} insight${run.insights_generated !== 1 ? 's' : ''} found`
                    : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
