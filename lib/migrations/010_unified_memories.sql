-- Migration 010: Unified memories table + self-improving system tables
--
-- Changes:
--   1. Rename account_memories → memories, add scope + business_type_tag columns
--   2. Create interaction_outcomes   (learning signal: action → outcome pairs)
--   3. Create improvement_suggestions (evaluator output, pending owner review)
--   4. Create evaluation_rubrics      (accepted quality criteria)
--   5. Add accounts.business_type_tag (freeform AI-inferred tag, not a FK)
--   6. Add accounts.business_profile_bootstrapped (tracks cold-start status)
--
-- Philosophy:
--   Business type is not a schema constraint — it's a freeform tag the AI writes.
--   All memory (account context, member facts, cross-business patterns) lives in
--   one table, differentiated by scope. No rigid business_type_contexts hierarchy.
--
-- Run in Supabase SQL editor after deploying the corresponding code changes.

-- ── 1. Rename account_memories → memories ─────────────────────────────────────

ALTER TABLE account_memories RENAME TO memories;

-- Add scope column (all existing rows are account-scoped)
ALTER TABLE memories ADD COLUMN scope text NOT NULL DEFAULT 'account';

-- Add member_id if not already present (some versions had it, some didn't)
ALTER TABLE memories ADD COLUMN IF NOT EXISTS member_id text;

-- Add business_type_tag for cross-business pattern rows (freeform, not a FK)
ALTER TABLE memories ADD COLUMN business_type_tag text;

-- Rename indexes
ALTER INDEX IF EXISTS idx_account_memories_account_active
  RENAME TO idx_memories_account_scope;
ALTER INDEX IF EXISTS idx_account_memories_member
  RENAME TO idx_memories_member;

-- New indexes
CREATE INDEX IF NOT EXISTS idx_memories_scope
  ON memories(scope);
CREATE INDEX IF NOT EXISTS idx_memories_business_type
  ON memories(business_type_tag) WHERE business_type_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memories_system
  ON memories(scope) WHERE scope = 'system';

-- Update RLS policy
DROP POLICY IF EXISTS account_memories_scope ON memories;

CREATE POLICY memories_rls ON memories
  FOR ALL
  USING (
    -- account-scoped and member-scoped: user must be a team member of the account
    (account_id IS NOT NULL AND account_id IN (
      SELECT account_id FROM team_members WHERE user_id = auth.uid()
    ))
    -- system-wide memories are readable by all authenticated users
    OR scope = 'system'
    -- business_type memories are readable by all (no PII, aggregated only)
    OR scope = 'business_type'
  );

-- ── 2. interaction_outcomes ───────────────────────────────────────────────────
-- Raw signal: one row per closed task interaction.
-- Source of truth for all learning. Cross-business analysis reads ONLY from here.
-- Account-private fields (message_sent, context_summary, edit_summary) NEVER
-- cross tenant boundaries. Only structural fields cross tenants.

CREATE TABLE IF NOT EXISTS interaction_outcomes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  task_id           uuid NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,

  -- freeform tag from account's business profile at time of interaction
  -- not a FK — reflects whatever the AI inferred about this account
  business_type_tag text,

  -- AI-generated description of what kind of interaction this was
  -- e.g. "churn-risk outreach, touch 1, member absent 18 days"
  interaction_type  text NOT NULL,

  -- account-private fields — NEVER used in cross-tenant analysis
  context_summary   text,    -- AI-authored summary of the situation
  message_sent      text,    -- what was actually sent
  edit_summary      text,    -- if owner edited: AI-authored description of the change

  -- outcome
  outcome           text,    -- 'engaged' | 'recovered' | 'churned' | 'unresponsive' | 'pending'
  days_to_outcome   integer,
  attributed_value  decimal, -- estimated $ value of the outcome (rounded to nearest $50 for cross-tenant)

  -- structural fields — safe for cross-tenant analysis (no PII)
  touch_number      integer,           -- which touch in the sequence (1, 2, 3...)
  message_length    integer,           -- character count
  sent_at_hour      integer,           -- 0–23, local time
  owner_edited      boolean DEFAULT false,

  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interaction_outcomes_account
  ON interaction_outcomes(account_id);
CREATE INDEX IF NOT EXISTS idx_interaction_outcomes_task
  ON interaction_outcomes(task_id);
CREATE INDEX IF NOT EXISTS idx_interaction_outcomes_business_type
  ON interaction_outcomes(business_type_tag) WHERE business_type_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interaction_outcomes_outcome
  ON interaction_outcomes(outcome, created_at);

ALTER TABLE interaction_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY interaction_outcomes_rls ON interaction_outcomes
  FOR ALL
  USING (account_id IN (
    SELECT account_id FROM team_members WHERE user_id = auth.uid()
  ));

-- ── 3. improvement_suggestions ────────────────────────────────────────────────
-- Evaluator output. Five types: memory | skill | rubric | prompt | calibration.
-- Everything is a suggestion until the owner accepts it (or auto-apply kicks in).

CREATE TABLE IF NOT EXISTS improvement_suggestions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- null = cross-business suggestion (no specific account)
  account_id            uuid REFERENCES accounts(id) ON DELETE CASCADE,

  suggestion_type       text NOT NULL,
  -- 'memory'       → proposed_change: { content, category_hint, confidence }
  -- 'skill'        → proposed_change: { applies_when, domain, guidance }
  -- 'rubric'       → proposed_change: { criteria[], applies_to_task_types[] }
  -- 'prompt'       → proposed_change: { instruction, applies_to_skills[] }
  -- 'calibration'  → proposed_change: { current_behavior, suggested_behavior, evidence_summary }

  title                 text NOT NULL,
  description           text NOT NULL,     -- owner-readable explanation of what was learned
  proposed_change       jsonb NOT NULL,
  evidence              jsonb NOT NULL,
  -- { task_ids, outcome_stats, reasoning, sample_count }
  -- NEVER includes message text or PII for cross-business suggestions

  confidence_score      decimal NOT NULL,  -- 0.0–1.0
  evidence_strength     text NOT NULL,     -- 'strong' | 'moderate' | 'weak'
  status                text DEFAULT 'pending',
  -- 'pending' | 'accepted' | 'dismissed' | 'auto_applied'

  privacy_tier          text NOT NULL,
  -- 'account_private'      → only for this account
  -- 'business_type_shared' → relevant to accounts with same business_type_tag
  -- 'system_wide'          → relevant to all accounts

  -- freeform tag: which business type this cross-business suggestion applies to
  -- null for account_private; set for shared suggestions
  business_type_tag     text,

  source                text NOT NULL,
  -- 'post_task_eval' | 'weekly_batch' | 'cross_business' | 'edit_analysis'

  related_task_ids      uuid[],
  auto_apply_eligible   boolean DEFAULT false,

  created_at            timestamptz DEFAULT now(),
  reviewed_at           timestamptz,
  applied_at            timestamptz
);

CREATE INDEX IF NOT EXISTS idx_improvement_suggestions_account
  ON improvement_suggestions(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_improvement_suggestions_status
  ON improvement_suggestions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_improvement_suggestions_business_type
  ON improvement_suggestions(business_type_tag) WHERE business_type_tag IS NOT NULL;

ALTER TABLE improvement_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY improvement_suggestions_rls ON improvement_suggestions
  FOR ALL
  USING (
    account_id IN (SELECT account_id FROM team_members WHERE user_id = auth.uid())
    OR account_id IS NULL  -- cross-business suggestions visible to all
  );

-- ── 4. evaluation_rubrics ─────────────────────────────────────────────────────
-- Accepted criteria the evaluator uses to judge agent output quality.

CREATE TABLE IF NOT EXISTS evaluation_rubrics (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- null = system-wide rubric; set = account-specific
  account_id            uuid REFERENCES accounts(id) ON DELETE CASCADE,

  -- null = account-specific; set = applies to matching business type
  business_type_tag     text,

  name                  text NOT NULL,
  criteria              jsonb NOT NULL,   -- [{ name, description, weight }]
  applies_to            text[],           -- task types / skill names; empty = general

  source_suggestion_id  uuid REFERENCES improvement_suggestions(id),
  active                boolean DEFAULT true,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evaluation_rubrics_account
  ON evaluation_rubrics(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evaluation_rubrics_business_type
  ON evaluation_rubrics(business_type_tag) WHERE business_type_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evaluation_rubrics_active
  ON evaluation_rubrics(active) WHERE active = true;

ALTER TABLE evaluation_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY evaluation_rubrics_rls ON evaluation_rubrics
  FOR ALL
  USING (
    account_id IN (SELECT account_id FROM team_members WHERE user_id = auth.uid())
    OR account_id IS NULL  -- system-wide rubrics visible to all
  );

-- ── 5. accounts: business context fields ──────────────────────────────────────

ALTER TABLE accounts
  -- AI-inferred business type tag — freeform, not a FK, updateable
  -- e.g. 'crossfit_gym', 'yoga_studio', 'bjj_school'
  -- Written by the GM Agent bootstrap call on first connect
  ADD COLUMN IF NOT EXISTS business_type_tag          text,

  -- true once the bootstrap LLM call has run and written the business_profile memory
  ADD COLUMN IF NOT EXISTS business_profile_bootstrapped boolean DEFAULT false;
