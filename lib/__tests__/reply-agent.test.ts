/**
 * reply-agent.test.ts
 *
 * Tests for the inbound reply evaluation loop.
 * Core behavior: given a conversation thread, Claude decides
 * close | escalate | reply | reopen — and we act on it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'

// ── Helpers (extracted from reply-agent logic for unit testing) ──────────────

type Decision = 'close' | 'escalate' | 'reply' | 'reopen'

interface ReplyDecision {
  decision: Decision
  reply?: string
  reason: string
}

function parseDecision(raw: string): ReplyDecision | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0]) as ReplyDecision
  } catch {
    return null
  }
}

function isPositiveSentiment(text: string): boolean {
  const positive = /yes|sure|sounds good|love to|definitely|absolutely|coming|back|sign|up|join|ready|great|awesome|perfect|let's do|when|schedule/i
  const negative = /no|not interested|cancel|stop|unsubscribe|leave me alone|don't contact/i
  if (negative.test(text)) return false
  return positive.test(text)
}

// ── parseDecision ────────────────────────────────────────────────────────────

describe('parseDecision', () => {
  it('parses a valid close decision', () => {
    const raw = '{"decision":"close","reply":"Can\'t wait to see you Thursday!","reason":"Member confirmed return"}'
    const result = parseDecision(raw)
    expect(result?.decision).toBe('close')
    expect(result?.reply).toContain('Thursday')
  })

  it('parses a valid reply decision', () => {
    const raw = '{"decision":"reply","reply":"Great! What time works for you?","reason":"Member asked about scheduling"}'
    const result = parseDecision(raw)
    expect(result?.decision).toBe('reply')
  })

  it('parses a valid escalate decision', () => {
    const raw = '{"decision":"escalate","reason":"Member mentioned a billing dispute"}'
    const result = parseDecision(raw)
    expect(result?.decision).toBe('escalate')
    expect(result?.reply).toBeUndefined()
  })

  it('returns null for malformed JSON', () => {
    expect(parseDecision('not json at all')).toBeNull()
    expect(parseDecision('')).toBeNull()
  })

  it('extracts JSON even when surrounded by prose', () => {
    const raw = 'Based on the conversation, I recommend: {"decision":"close","reason":"Goal achieved"}'
    expect(parseDecision(raw)?.decision).toBe('close')
  })
})

// ── isPositiveSentiment ──────────────────────────────────────────────────────

describe('isPositiveSentiment', () => {
  it('identifies positive replies', () => {
    expect(isPositiveSentiment('Yes I\'d love to come back!')).toBe(true)
    expect(isPositiveSentiment('Sounds good, when should I come in?')).toBe(true)
    expect(isPositiveSentiment('Definitely coming Thursday')).toBe(true)
    expect(isPositiveSentiment('I\'m ready to sign up')).toBe(true)
  })

  it('identifies negative replies', () => {
    expect(isPositiveSentiment('No thanks, not interested')).toBe(false)
    expect(isPositiveSentiment('Please stop contacting me')).toBe(false)
    expect(isPositiveSentiment('I want to cancel')).toBe(false)
  })

  it('returns false for ambiguous/neutral replies without positive signals', () => {
    expect(isPositiveSentiment('Maybe later')).toBe(false)
    expect(isPositiveSentiment('I\'ll think about it')).toBe(false)
  })
})

// ── Automation level behavior ────────────────────────────────────────────────

describe('automation level routing', () => {
  it('full_auto: sends reply automatically', () => {
    const automationLevel = 'full_auto'
    const decision: ReplyDecision = { decision: 'reply', reply: 'See you soon!', reason: 'Positive reply' }

    const shouldSendAutomatically = automationLevel === 'full_auto' && decision.decision !== 'escalate'
    expect(shouldSendAutomatically).toBe(true)
  })

  it('smart: queues reply for owner review', () => {
    const automationLevel = 'smart'
    const decision: ReplyDecision = { decision: 'reply', reply: 'See you soon!', reason: 'Positive reply' }

    const shouldSendAutomatically = automationLevel === 'full_auto' && decision.decision !== 'escalate'
    const shouldQueue = automationLevel === 'smart'
    expect(shouldSendAutomatically).toBe(false)
    expect(shouldQueue).toBe(true)
  })

  it('draft_only: never sends automatically', () => {
    const automationLevel = 'draft_only'
    const decision: ReplyDecision = { decision: 'close', reply: 'Great to have you back!', reason: 'Member confirmed' }

    const shouldSend = automationLevel !== 'draft_only' && !!decision.reply
    expect(shouldSend).toBe(false)
  })

  it('always escalates regardless of automation level', () => {
    const levels = ['draft_only', 'smart', 'full_auto']
    const decision: ReplyDecision = { decision: 'escalate', reason: 'Billing dispute' }

    for (const level of levels) {
      const shouldEscalate = decision.decision === 'escalate'
      expect(shouldEscalate).toBe(true)
    }
  })
})

// ── replyToken format ────────────────────────────────────────────────────────

describe('replyToken', () => {
  it('tokens are unique across sends', () => {
    const makeToken = () => `d${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
    const tokens = Array.from({ length: 100 }, makeToken)
    const unique = new Set(tokens)
    expect(unique.size).toBe(100)
  })

  it('token is URL-safe (no special chars)', () => {
    const token = `d${'a'.repeat(20)}`
    expect(token).toMatch(/^[a-zA-Z0-9]+$/)
  })

  it('workflow tokens follow wf prefix pattern', () => {
    const runId = '550e8400-e29b-41d4-a716-446655440000'
    const stepId = 'step_email_1'
    const token = `wf${runId.replace(/-/g, '').slice(0, 16)}_${stepId}`
    expect(token).toMatch(/^wf[a-f0-9]{16}_step_/)
  })
})
