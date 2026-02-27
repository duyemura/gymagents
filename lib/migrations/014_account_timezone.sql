-- Migration 014: Add timezone column to accounts table
--
-- Stores the IANA timezone for each account (e.g. 'America/Chicago').
-- Used by cron jobs, analysis windows, message scheduling, and display
-- to respect the gym's local time instead of assuming UTC.

-- Add the timezone column (nullable, text for IANA timezone strings)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS timezone text;

-- Set known accounts
-- KS Athletic Club → Central Time (Kansas)
UPDATE public.accounts
  SET timezone = 'America/Chicago'
  WHERE account_name ILIKE '%KS Athletic%';

-- PP East → Eastern Time (South Carolina)
UPDATE public.accounts
  SET timezone = 'America/New_York'
  WHERE account_name ILIKE '%PP East%';

-- Index for efficient lookups (most queries already filter by id, but this
-- helps if we ever need to batch accounts by timezone for cron scheduling)
CREATE INDEX IF NOT EXISTS idx_accounts_timezone ON public.accounts(timezone);
