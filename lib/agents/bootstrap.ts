/**
 * bootstrapBusinessProfile
 *
 * One-time (repeatable) LLM call that profiles a newly connected business.
 * Writes a business_profile memory (Layer 3 of the prompt stack) and sets
 * accounts.business_type_tag so agents know what kind of business they're serving.
 *
 * Designed to be called fire-and-forget from the connect flow, but also
 * triggerable on-demand (force=true) so owners can refresh their profile.
 *
 * Dependency-injected: Claude dep is injected so this function is fully testable
 * without an API key. Use callClaude() from lib/claude.ts to build the dep.
 */

import { supabaseAdmin } from '../supabase'
import { createMemory } from '../db/memories'

// ── GM Agent seeding ──────────────────────────────────────────────────────────

/**
 * Ensure every account has a GM agent.
 * Idempotent — safe to call on every connect (upserts on account_id + skill_type).
 */
export async function seedGMAgent(accountId: string): Promise<void> {
  await supabaseAdmin
    .from('agents')
    .upsert(
      {
        account_id: accountId,
        name: 'GM',
        skill_type: 'gm',
        description: 'Your always-on business assistant. Ask anything.',
        trigger_mode: 'manual',
        is_active: true,
        is_system: true,
      },
      { onConflict: 'account_id,skill_type', ignoreDuplicates: true },
    )
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BootstrapParams {
  accountId: string
  accountName: string
  memberCount: number
}

export interface BootstrapProfile {
  businessTypeTag: string
  profile: string
}

export interface BootstrapResult {
  profile: BootstrapProfile
  skipped: boolean
}

export interface BootstrapDeps {
  claude: {
    evaluate: (system: string, prompt: string) => Promise<string>
  }
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are analyzing a new business that just connected to a member retention platform. Create a concise business profile that helps AI agents communicate on their behalf. Respond with valid JSON only, no markdown fences.`

function buildUserPrompt(accountName: string, memberCount: number): string {
  return `Business name: ${accountName}
Active members: ${memberCount}

Infer the business type from the name and write a profile AI agents can use when communicating.

Return JSON only:
{
  "business_type_tag": "snake_case tag, e.g. crossfit_gym, yoga_studio, bjj_school, pilates_studio, boot_camp, martial_arts, dance_studio, fitness_gym",
  "profile": "2-3 sentence profile: what type of business, typical member vibe, normal attendance frequency, preferred communication tone, sign-off style"
}`
}

// ── Core function ─────────────────────────────────────────────────────────────

export async function bootstrapBusinessProfile(
  params: BootstrapParams,
  deps: BootstrapDeps,
  opts: { force?: boolean } = {},
): Promise<BootstrapResult> {
  const { accountId, accountName, memberCount } = params

  // Skip if already bootstrapped (unless forced)
  if (!opts.force) {
    const { data: account } = await supabaseAdmin
      .from('accounts')
      .select('business_profile_bootstrapped')
      .eq('id', accountId)
      .single()

    if (account?.business_profile_bootstrapped) {
      return { profile: { businessTypeTag: '', profile: '' }, skipped: true }
    }
  }

  // Call Claude to profile the business
  const raw = await deps.claude.evaluate(SYSTEM_PROMPT, buildUserPrompt(accountName, memberCount))

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('[bootstrap] No JSON in Claude response')
  }

  const parsed = JSON.parse(jsonMatch[0])
  const profile: BootstrapProfile = {
    businessTypeTag: (parsed.business_type_tag as string) || 'fitness_business',
    profile:
      (parsed.profile as string) ||
      `${accountName}, fitness business with ${memberCount} active members.`,
  }

  // Write the business profile as a memory (Layer 3 of the prompt stack)
  await createMemory({
    accountId,
    category: 'gym_context',
    content: profile.profile,
    importance: 5,
    scope: 'global',
    source: 'agent',
  })

  // Update account: set tag + mark as bootstrapped
  await supabaseAdmin
    .from('accounts')
    .update({
      business_type_tag: profile.businessTypeTag,
      business_profile_bootstrapped: true,
    })
    .eq('id', accountId)

  return { profile, skipped: false }
}
