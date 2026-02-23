import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SYSTEM_WORKFLOWS = [
  {
    name: 'Lapsed Member Win-Back',
    goal: 'Re-engage a lapsed member and get them back through the door',
    timeout_days: 30,
    trigger_config: { type: 'member_tag', tag: 'at-risk' },
    steps: [
      {
        id: 'step_email_1',
        kind: 'outreach',
        label: 'Warm re-engagement email',
        config: {
          channel: 'email',
          prompt_override: 'Send a warm, personal check-in. Reference that they used to be a regular. No pressure. Ask how they\'re doing.',
          wait_for_reply: true,
          reply_timeout_days: 5,
          on_reply_positive: 'step_tag_winback',
          on_reply_negative: 'step_close',
          on_no_reply: 'step_followup',
        },
      },
      {
        id: 'step_followup',
        kind: 'outreach',
        label: 'Follow-up if no reply',
        config: {
          channel: 'email',
          prompt_override: 'Short follow-up — mention a specific class, event, or coach they might enjoy. Make it feel like a friend reaching out, not a business.',
          wait_for_reply: true,
          reply_timeout_days: 5,
          on_reply_positive: 'step_tag_winback',
          on_reply_negative: 'step_close',
          on_no_reply: 'step_close',
        },
      },
      {
        id: 'step_tag_winback',
        kind: 'integration',
        label: 'Tag member as Win-Back in PushPress',
        config: { type: 'pushpress_tag', tag: 'win-back', on_sent: 'step_alert_owner' },
      },
      {
        id: 'step_alert_owner',
        kind: 'owner_alert',
        label: 'Alert owner',
        config: {
          message: '{memberName} responded positively to re-engagement — give them a warm welcome back!',
          on_sent: 'goal_achieved',
        },
      },
      {
        id: 'step_close',
        kind: 'owner_alert',
        label: 'Close — no response',
        config: {
          message: '{memberName} did not respond to re-engagement. Closing workflow.',
          on_sent: 'give_up',
        },
      },
    ],
  },

  {
    name: 'Trial → Paid Conversion',
    goal: 'Convert a trial member to a paying membership',
    timeout_days: 21,
    trigger_config: { type: 'member_tag', tag: 'trial' },
    steps: [
      {
        id: 'step_wait_3',
        kind: 'wait',
        label: 'Wait 3 days into trial',
        config: { days: 3, then: 'step_checkin' },
      },
      {
        id: 'step_checkin',
        kind: 'outreach',
        label: 'Mid-trial check-in',
        config: {
          channel: 'email',
          prompt_override: 'Check in mid-trial. Ask how the first week is going, mention a specific class they might like, and offer help if they have questions. Keep it casual and supportive.',
          wait_for_reply: true,
          reply_timeout_days: 3,
          on_reply_positive: 'step_offer',
          on_reply_negative: 'step_feedback',
          on_no_reply: 'step_nudge',
        },
      },
      {
        id: 'step_nudge',
        kind: 'outreach',
        label: 'Nudge if no reply',
        config: {
          channel: 'email',
          prompt_override: 'Gentle nudge before trial ends. Mention the deadline naturally, not pushy. Offer a free session with a coach as an incentive to convert.',
          wait_for_reply: true,
          reply_timeout_days: 3,
          on_reply_positive: 'step_offer',
          on_reply_negative: 'step_feedback',
          on_no_reply: 'give_up',
        },
      },
      {
        id: 'step_offer',
        kind: 'outreach',
        label: 'Membership offer',
        config: {
          channel: 'email',
          prompt_override: 'Make the membership offer. Highlight what they get as a full member vs trial. Offer to answer any questions. Keep it warm, not salesy.',
          wait_for_reply: true,
          reply_timeout_days: 4,
          on_reply_positive: 'step_convert',
          on_reply_negative: 'step_feedback',
          on_no_reply: 'give_up',
        },
      },
      {
        id: 'step_feedback',
        kind: 'internal_task',
        label: 'Collect feedback from negative response',
        config: {
          title: 'Review {memberName}\'s objections and decide next step',
          on_done: 'give_up',
        },
      },
      {
        id: 'step_convert',
        kind: 'integration',
        label: 'Tag as Converted in PushPress',
        config: { type: 'pushpress_tag', tag: 'converted', on_sent: 'goal_achieved' },
      },
    ],
  },

  {
    name: 'New Member Onboarding',
    goal: 'Ensure every new member gets a personal welcome and coach intro within their first week',
    timeout_days: 14,
    trigger_config: { type: 'member_tag', tag: 'new-member' },
    steps: [
      {
        id: 'step_welcome',
        kind: 'outreach',
        label: 'Welcome email day 1',
        config: {
          channel: 'email',
          prompt_override: 'Send a warm welcome email on day 1. Introduce the gym culture, mention that a coach will reach out this week. Make them feel like part of the family immediately.',
          wait_for_reply: false,
          on_sent: 'step_coach_task',
        },
      },
      {
        id: 'step_coach_task',
        kind: 'internal_task',
        label: 'Coach intro task',
        config: {
          title: 'Schedule 1:1 intro session with {memberName} within first week',
          on_done: 'step_wait_7',
        },
      },
      {
        id: 'step_wait_7',
        kind: 'wait',
        label: 'Wait 7 days',
        config: { days: 7, then: 'step_checkin_week2' },
      },
      {
        id: 'step_checkin_week2',
        kind: 'outreach',
        label: 'Week 2 check-in',
        config: {
          channel: 'email',
          prompt_override: 'Check in after the first full week. Ask what classes they\'ve tried, if they\'ve met any other members, and what they\'re enjoying. Personal, curious, no pressure.',
          wait_for_reply: true,
          reply_timeout_days: 3,
          on_reply_positive: 'goal_achieved',
          on_reply_negative: 'step_flag',
          on_no_reply: 'step_flag',
        },
      },
      {
        id: 'step_flag',
        kind: 'owner_alert',
        label: 'Flag for owner review',
        config: {
          message: '{memberName} hasn\'t responded to week 2 check-in — might need a personal touch.',
          on_sent: 'give_up',
        },
      },
    ],
  },
]

async function seed() {
  console.log('Seeding system workflows...')

  // Clear existing system workflows
  const { error: delErr } = await supabase
    .from('workflows')
    .delete()
    .is('gym_id', null)

  if (delErr) {
    console.error('Delete error:', delErr.message)
    // Table might not exist yet
    console.log('\nIMPORTANT: Run this SQL in Supabase first:\n')
    console.log(`
CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id text,
  name text NOT NULL,
  goal text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}',
  steps jsonb NOT NULL DEFAULT '[]',
  timeout_days int NOT NULL DEFAULT 30,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id),
  gym_id text NOT NULL,
  member_id text NOT NULL,
  member_email text NOT NULL,
  member_name text,
  status text NOT NULL DEFAULT 'active',
  current_step text NOT NULL,
  goal text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  achieved_at timestamptz,
  action_id text
);

CREATE TABLE IF NOT EXISTS workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow_runs(id),
  step_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_runs_gym_status ON workflow_runs(gym_id, status);
CREATE INDEX IF NOT EXISTS workflow_runs_member_email ON workflow_runs(member_email);
CREATE INDEX IF NOT EXISTS workflow_events_run_id ON workflow_events(run_id);
    `)
    return
  }

  const { data, error } = await supabase
    .from('workflows')
    .insert(SYSTEM_WORKFLOWS.map(w => ({ ...w, gym_id: null })))
    .select()

  if (error) {
    console.error('Insert error:', error.message)
    return
  }

  console.log(`✅ Seeded ${data.length} system workflows:`)
  data.forEach(w => console.log(`  - ${w.name} (${w.id})`))
}

seed().catch(console.error)
