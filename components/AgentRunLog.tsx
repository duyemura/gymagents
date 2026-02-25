'use client'

import { useEffect, useRef } from 'react'

export type LogEntry = {
  msg: string
  type: 'step' | 'found' | 'done' | 'error'
}

interface AgentRunLogProps {
  agentName: string
  entries: LogEntry[]
  done: boolean
}

const TYPE_COLOR: Record<LogEntry['type'], string> = {
  step:  '#6B7280',   // gray
  found: '#F59E0B',   // amber — something was discovered
  done:  '#22C55E',   // green
  error: '#EF4444',   // red
}

export default function AgentRunLog({ agentName, entries, done }: AgentRunLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom as new entries arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#0D1117' }}>
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#4B5563' }}>
            {agentName}
          </span>
          {!done && (
            <span className="flex items-center gap-0.5 ml-1">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full"
                  style={{
                    backgroundColor: '#0063FF',
                    animation: 'dotPulse 1.4s ease-in-out infinite',
                    animationDelay: `${i * 0.16}s`,
                  }}
                />
              ))}
            </span>
          )}
        </div>
        {done && (
          <span className="text-[10px] font-semibold" style={{ color: '#22C55E' }}>
            ✓ complete
          </span>
        )}
      </div>

      {/* Log lines */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5 font-mono">
        {entries.map((entry, i) => (
          <div
            key={i}
            className="flex items-start gap-2 text-xs"
            style={{ animation: 'fadeInUp 0.15s ease forwards', opacity: 0 }}
          >
            <span style={{ color: '#374151', flexShrink: 0 }}>›</span>
            <span style={{ color: TYPE_COLOR[entry.type], lineHeight: '1.5' }}>
              {entry.msg}
            </span>
          </div>
        ))}

        {/* Blinking cursor on last active line */}
        {!done && (
          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: '#374151' }}>›</span>
            <span
              className="inline-block w-1.5 h-3"
              style={{
                backgroundColor: '#0063FF',
                animation: 'pulse 1s ease-in-out infinite',
              }}
            />
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
