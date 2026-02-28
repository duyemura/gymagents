-- ============================================================
-- Migration 008: gyms → accounts
--
-- Renames the core entity from "gym" to "account" so the
-- platform works for any subscription business: yoga studios,
-- BJJ academies, Pilates, coworking spaces, salons, etc.
--
-- Also adds team_members for multi-user support per account
-- (replacing the 1:1 gyms.user_id constraint).
--
-- SAFE TO RUN: uses IF EXISTS guards, no destructive drops.
-- Run in Supabase SQL Editor.
-- ============================================================

-- ── 1. Rename gyms → accounts ────────────────────────────────────────────────
ALTER TABLE public.gyms RENAME TO accounts;
ALTER TABLE public.accounts RENAME COLUMN gym_name TO account_name;

COMMENT ON TABLE public.accounts IS
  'Subscription business accounts (gyms, studios, coworking spaces, salons, etc.)';

-- ── 2. Rename gym_id on tables with FK to accounts ───────────────────────────
-- FK constraints still work after table rename (they reference by OID).
-- We rename the columns for code clarity.

ALTER TABLE public.agent_runs         RENAME COLUMN gym_id TO account_id;
ALTER TABLE public.autopilots         RENAME COLUMN gym_id TO account_id;
ALTER TABLE public.webhook_events     RENAME COLUMN gym_id TO account_id;
ALTER TABLE public.agent_subscriptions RENAME COLUMN gym_id TO account_id;
ALTER TABLE public.agent_email_threads RENAME COLUMN gym_id TO account_id;
ALTER TABLE public.artifacts          RENAME COLUMN gym_id TO account_id;

-- ── 3. Rename gym_id on tables without FK (demo-safe UUIDs) ──────────────────
ALTER TABLE public.agent_events          RENAME COLUMN gym_id TO account_id;
ALTER TABLE public.agent_tasks           RENAME COLUMN gym_id TO account_id;
ALTER TABLE public.task_conversations    RENAME COLUMN gym_id TO account_id;
ALTER TABLE public.outbound_messages     RENAME COLUMN gym_id TO account_id;
ALTER TABLE public.communication_optouts RENAME COLUMN gym_id TO account_id;
ALTER TABLE public.agent_commands        RENAME COLUMN gym_id TO account_id;
ALTER TABLE public.gm_chat_messages      RENAME COLUMN gym_id TO account_id;

-- ── 4. Rename gym_memories → account_memories ────────────────────────────────
-- Drop RLS policy first (stored as SQL text, references old column name)
DROP POLICY IF EXISTS gym_memories_gym_scope ON gym_memories;

ALTER TABLE public.gym_memories RENAME TO account_memories;
ALTER TABLE public.account_memories RENAME COLUMN gym_id TO account_id;

-- Recreate RLS policy with new names
CREATE POLICY account_memories_scope ON account_memories
  FOR ALL
  USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

-- Rename indexes
ALTER INDEX IF EXISTS idx_gym_memories_gym_active RENAME TO idx_account_memories_account_active;
ALTER INDEX IF EXISTS idx_gym_memories_member     RENAME TO idx_account_memories_member;

-- ── 5. Rename gym_gmail → account_gmail ──────────────────────────────────────
ALTER TABLE public.gym_gmail RENAME TO account_gmail;
ALTER TABLE public.account_gmail RENAME COLUMN gym_id TO account_id;

-- ── 6. Rename gym_kpi_snapshots → account_kpi_snapshots ──────────────────────
-- Wrapped in DO block — this table may have been created outside migrations.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gym_kpi_snapshots'
  ) THEN
    ALTER TABLE public.gym_kpi_snapshots RENAME TO account_kpi_snapshots;
    ALTER TABLE public.account_kpi_snapshots RENAME COLUMN gym_id TO account_id;
    RAISE NOTICE 'Renamed gym_kpi_snapshots → account_kpi_snapshots';
  ELSE
    RAISE NOTICE 'gym_kpi_snapshots not found — skipping (may already be renamed or not yet created)';
  END IF;
END $$;

-- Rename artifacts index
ALTER INDEX IF EXISTS idx_artifacts_gym RENAME TO idx_artifacts_account;

-- ── 7. Update the unique constraint on autopilots ────────────────────────────
-- The UNIQUE(gym_id, skill_type) constraint was renamed to account_id above.
-- Constraint names are cosmetic — no functional change needed.

-- ── 8. Add team_members table ─────────────────────────────────────────────────
-- Replaces the 1:1 accounts.user_id with a many-to-many join.
-- Supports multiple staff per account and future Google OAuth.
-- The original accounts.user_id column remains for now (backward compat)
-- and will be migrated to team_members in a follow-up.
CREATE TABLE IF NOT EXISTS public.team_members (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role         TEXT        NOT NULL DEFAULT 'owner', -- 'owner' | 'admin' | 'viewer'
  invited_by   UUID        REFERENCES public.users(id),
  invited_at   TIMESTAMPTZ DEFAULT now(),
  accepted_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_account ON public.team_members(account_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user    ON public.team_members(user_id);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_members_own_rows ON team_members
  FOR ALL
  USING (user_id = auth.uid());

-- ── 9. Backfill team_members from existing accounts.user_id ──────────────────
-- Insert one owner row per existing account. Safe to re-run (ON CONFLICT DO NOTHING).
INSERT INTO public.team_members (account_id, user_id, role, accepted_at)
SELECT id, user_id, 'owner', now()
FROM public.accounts
WHERE user_id IS NOT NULL
ON CONFLICT (account_id, user_id) DO NOTHING;

DO $$ BEGIN
  RAISE NOTICE 'Migration 008 complete: gyms → accounts, team_members created and backfilled.';
END $$;
