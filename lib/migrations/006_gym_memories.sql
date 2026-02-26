-- ============================================================
-- Migration 006: Gym Memories
--
-- Agent intelligence layer — persistent memory per gym.
-- Stores owner preferences, member facts, gym context, and
-- learned patterns that agents inject into their prompts.
--
-- Run in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS gym_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  category TEXT NOT NULL,           -- 'preference' | 'member_fact' | 'gym_context' | 'learned_pattern'
  content TEXT NOT NULL,
  importance INT NOT NULL DEFAULT 3, -- 1-5 (5 = always include in context)
  scope TEXT NOT NULL DEFAULT 'global', -- 'global' | 'retention' | 'sales' | task UUID
  member_id TEXT,                    -- NULL for gym-wide, member UUID for member-specific
  source TEXT NOT NULL,              -- 'owner' | 'agent' | 'system'
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index: fetch memories for a gym (active only, ordered by importance)
CREATE INDEX IF NOT EXISTS idx_gym_memories_gym_active
  ON gym_memories (gym_id, active, importance DESC)
  WHERE active = true;

-- Index: member-specific memories
CREATE INDEX IF NOT EXISTS idx_gym_memories_member
  ON gym_memories (gym_id, member_id)
  WHERE member_id IS NOT NULL AND active = true;

-- RLS: gym owners can only see their own memories
ALTER TABLE gym_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY gym_memories_gym_scope ON gym_memories
  FOR ALL
  USING (gym_id IN (SELECT id FROM gyms WHERE user_id = auth.uid()));
