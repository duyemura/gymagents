-- Migration 018: GM agent — system flag + unique constraint for seeding
--
-- Adds is_system column to agents table (marks built-in agents like GM).
-- Adds unique constraint on (account_id, skill_type) so seedGMAgent() can upsert safely.
-- System agents are pinned in the UI and cannot be deleted.

ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

-- Unique constraint so we can upsert on (account_id, skill_type)
-- Only one agent of each skill_type per account for system agents.
-- (non-system agents can share skill types — owners can create multiple retention agents)
-- We scope the uniqueness to system agents only via a partial index:
CREATE UNIQUE INDEX IF NOT EXISTS agents_account_system_skill_type_idx
  ON agents (account_id, skill_type)
  WHERE is_system = true;
