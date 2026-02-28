-- Add run_hour to agents: 0-23 (UTC hour), default 9am
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS run_hour integer DEFAULT 9;
