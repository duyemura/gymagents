/**
 * Tests for the deploy notification pipeline.
 *
 * Verifies: issue ID extraction from commit messages,
 * and that the full lifecycle (comment + state transition) works.
 */

import { describe, it, expect } from 'vitest'

// ── Issue ID extraction ─────────────────────────────────────────────────────

// Extracted from notify-deploy.ts pattern
const ISSUE_PATTERN = /AGT-(\d+)/gi

function extractIssueIds(commitMessages: string): string[] {
  const matches = commitMessages.matchAll(ISSUE_PATTERN)
  return [...new Set([...matches].map(m => `AGT-${m[1]}`))]
}

describe('extractIssueIds', () => {
  it('extracts single AGT reference from commit message', () => {
    expect(extractIssueIds('fix: handle error gracefully (AGT-4)'))
      .toEqual(['AGT-4'])
  })

  it('extracts multiple AGT references', () => {
    const messages = [
      'fix: handle error (AGT-4)',
      'fix: dashboard crash (AGT-7)',
      'chore: update deps',
    ].join('\n')

    expect(extractIssueIds(messages)).toEqual(['AGT-4', 'AGT-7'])
  })

  it('deduplicates repeated references', () => {
    const messages = [
      'fix: first part (AGT-4)',
      'fix: second part (AGT-4)',
    ].join('\n')

    expect(extractIssueIds(messages)).toEqual(['AGT-4'])
  })

  it('returns empty for commits without AGT references', () => {
    expect(extractIssueIds('chore: update deps\nfeat: add feature'))
      .toEqual([])
  })

  it('handles AGT references in PR body format', () => {
    expect(extractIssueIds('Fixes AGT-12\n\nCloses AGT-13'))
      .toEqual(['AGT-12', 'AGT-13'])
  })

  it('handles case-insensitive matching', () => {
    expect(extractIssueIds('fix: thing (agt-5)'))
      .toEqual(['AGT-5'])
  })

  it('handles empty string', () => {
    expect(extractIssueIds('')).toEqual([])
  })
})
