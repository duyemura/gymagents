-- Migration 004: GM Agent Chat Messages
-- Unified log for proactive GM analysis events and reactive owner questions.
-- Both proactive findings and owner queries appear in one thread.

CREATE TABLE IF NOT EXISTS public.gm_chat_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        UUID        NOT NULL,
  role          TEXT        NOT NULL,          -- 'user', 'assistant', 'system_event'
  content       TEXT        NOT NULL,
  route         TEXT,                           -- how it was classified: 'direct_answer', 'inline_query', etc.
  action_type   TEXT,                           -- 'answer', 'data_table', 'recommendation', 'task_created', 'clarify'
  data          JSONB,                          -- table data if actionType = 'data_table'
  task_id       UUID,                           -- if GM created an agent_task from this exchange
  thinking_steps JSONB,                         -- array of reasoning steps for transparency
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast gym timeline queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_gm_chat_gym
  ON public.gm_chat_messages(gym_id, created_at DESC);

-- System events (GM analysis runs) also land here for unified timeline.
-- Example row:
--   role = 'system_event'
--   content = 'GM ran analysis. Found 3 insights, added to your To-Do.'
--
-- Owner questions land as role = 'user'
-- GM replies land as role = 'assistant'
