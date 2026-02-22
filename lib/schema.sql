-- BoxAssist Database Schema
-- Run this in Supabase SQL editor

-- Users table
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  stripe_customer_id text,
  stripe_subscription_status text,
  stripe_price_id text,
  trial_ends_at timestamptz,
  created_at timestamptz default now()
);

-- Gyms table
create table if not exists public.gyms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  pushpress_api_key text not null,
  pushpress_company_id text not null,
  gym_name text not null default 'Your Gym',
  member_count integer not null default 0,
  connected_at timestamptz default now()
);

-- Agent runs table
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete cascade not null,
  agent_type text not null,
  status text not null default 'running',
  input_summary text,
  output jsonb,
  action_taken text,
  created_at timestamptz default now()
);

-- Agent actions table
create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid references public.agent_runs(id) on delete cascade not null,
  action_type text not null,
  content jsonb,
  approved boolean,
  dismissed boolean,
  created_at timestamptz default now()
);

-- Autopilots table
create table if not exists public.autopilots (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete cascade not null,
  skill_type text not null,
  trigger_config jsonb default '{}',
  is_active boolean default true,
  last_run_at timestamptz,
  run_count integer default 0,
  approval_rate integer default 0,
  created_at timestamptz default now(),
  unique(gym_id, skill_type)
);

-- Enable RLS
alter table public.users enable row level security;
alter table public.gyms enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_actions enable row level security;
alter table public.autopilots enable row level security;

-- Service role has full access (used by backend)
-- No client-side policies needed since we use service role key in API routes
