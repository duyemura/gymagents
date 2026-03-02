#!/usr/bin/env npx tsx
/**
 * linear-update.ts — CLI for updating Linear tickets during fix sessions.
 *
 * Called by Claude during bug fix pipeline to document progress.
 *
 * Usage:
 *   npx tsx scripts/linear-update.ts state <issueId> <state>
 *   npx tsx scripts/linear-update.ts comment <issueId> <body>
 *   npx tsx scripts/linear-update.ts red <issueId> <testFile> <testName> <output>
 *   npx tsx scripts/linear-update.ts green <issueId> <testFile> <testName> <totalTests> <totalPassing>
 *   npx tsx scripts/linear-update.ts pr <issueId> <prUrl> <prTitle> <branch>
 *
 * Issue ID can be a UUID or an identifier like "AGT-4" (will be looked up).
 */

import { LinearClient } from '@linear/sdk'

async function main() {
  const [, , command, issueIdOrIdentifier, ...args] = process.argv

  if (!command || !issueIdOrIdentifier) {
    console.error('Usage: npx tsx scripts/linear-update.ts <command> <issueId> [args...]')
    console.error('Commands: state, comment, red, green, pr')
    process.exit(1)
  }

  if (!process.env.LINEAR_API_KEY) {
    console.error('LINEAR_API_KEY not set')
    process.exit(1)
  }

  const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY })
  const teamId = process.env.LINEAR_TEAM_ID

  // Resolve identifier (AGT-4) to UUID if needed
  let issueId = issueIdOrIdentifier
  if (issueIdOrIdentifier.match(/^[A-Z]+-\d+$/)) {
    const results = await client.searchIssues(issueIdOrIdentifier)
    const hit = results.nodes.find(i => i.identifier === issueIdOrIdentifier)
    if (!hit) {
      console.error(`Issue ${issueIdOrIdentifier} not found`)
      process.exit(1)
    }
    issueId = hit.id
    console.log(`Resolved ${issueIdOrIdentifier} → ${issueId}`)
  }

  // Get workflow states (cached per run)
  async function getStateId(stateName: string): Promise<string | null> {
    if (!teamId) return null
    const team = await client.team(teamId)
    const states = await team.states()

    // Map CLI state names to Linear state names
    const nameMap: Record<string, string> = {
      backlog: 'Backlog',
      inProgress: 'In Progress',
      inReview: 'In Review',
      stuck: 'Stuck',
      done: 'Done',
      cancelled: 'Canceled',
      duplicate: 'Duplicate',
      todo: 'Todo',
    }

    // First try exact name match (handles multiple states with same type)
    const targetName = nameMap[stateName]
    if (targetName) {
      const state = states.nodes.find(s => s.name === targetName)
      if (state) return state.id
    }

    // Fall back to case-insensitive name match
    const state = states.nodes.find(s => s.name.toLowerCase() === stateName.toLowerCase())
    return state?.id ?? null
  }

  switch (command) {
    case 'state': {
      const [state] = args
      if (!state) { console.error('Usage: state <issueId> <backlog|inProgress|done|cancelled>'); process.exit(1) }
      const stateId = await getStateId(state)
      if (!stateId) { console.error(`State "${state}" not found`); process.exit(1) }
      await client.updateIssue(issueId, { stateId })
      console.log(`✓ ${issueIdOrIdentifier} → ${state}`)
      break
    }

    case 'comment': {
      const body = args.join(' ')
      if (!body) { console.error('Usage: comment <issueId> <body>'); process.exit(1) }
      await client.createComment({ issueId, body })
      console.log(`✓ Comment posted on ${issueIdOrIdentifier}`)
      break
    }

    case 'red': {
      const [testFile, testName, ...outputParts] = args
      const output = outputParts.join(' ')
      const body = [
        '## 🔴 RED — Failing test written',
        '',
        `**Test file:** \`${testFile}\``,
        `**Test name:** "${testName}"`,
        '',
        '**Output (confirms test fails):**',
        '```',
        output,
        '```',
        '',
        'Test fails as expected — the bug is proven. Proceeding to fix.',
      ].join('\n')
      await client.createComment({ issueId, body })
      const stateId = await getStateId('inProgress')
      if (stateId) await client.updateIssue(issueId, { stateId })
      console.log(`✓ RED documented on ${issueIdOrIdentifier}, status → In Progress`)
      break
    }

    case 'green': {
      const [testFile, testName, totalTests, totalPassing] = args
      const body = [
        '## 🟢 GREEN — Fix applied, tests pass',
        '',
        `**Test file:** \`${testFile}\``,
        `**Test name:** "${testName}"`,
        '',
        `**Full suite:** ${totalPassing}/${totalTests} tests — all pass ✅`,
        '',
        'Fix verified. Creating PR.',
      ].join('\n')
      await client.createComment({ issueId, body })
      console.log(`✓ GREEN documented on ${issueIdOrIdentifier}`)
      break
    }

    case 'pr': {
      const [prUrl, prTitle, branch] = args
      const body = [
        '## 📦 PR Created',
        '',
        `**PR:** [${prTitle}](${prUrl})`,
        `**Branch:** \`${branch}\``,
        '',
        'Awaiting CI checks and review.',
      ].join('\n')
      await client.createComment({ issueId, body })
      console.log(`✓ PR documented on ${issueIdOrIdentifier}`)
      break
    }

    default:
      console.error(`Unknown command: ${command}`)
      console.error('Commands: state, comment, red, green, pr')
      process.exit(1)
  }
}

main().catch(err => {
  console.error('Error:', err.message || err)
  process.exit(1)
})
