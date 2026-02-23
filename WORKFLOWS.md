# GymAgents Workflow Engine — Design Doc

## Concept

Workflows are goal-driven agent programs. Instead of a single "scan → draft → send" action, 
a workflow has a **goal state** and the agent keeps driving actions toward it until done.

## Core primitives

### Workflow (template)
Defined by a gym owner or cloned from a system template.

```
goal:        "Get lapsed member back through the door"
trigger:     { type: 'member_tag', tag: 'at-risk' } | { type: 'schedule', cron: '...' } | { type: 'manual' }
steps:       [ Step ]
timeout_days: 30        # give up after this long
```

### Step
```
id:           'step_1'
kind:         'outreach' | 'internal_task' | 'owner_alert' | 'integration' | 'wait' | 'branch'
config:       { ... kind-specific ... }
on_success:   'step_2' | 'goal_achieved' | null
on_fail:      'step_3' | 'give_up' | null
```

### WorkflowRun (per member, per workflow)
```
id:           uuid
workflow_id:  fk → workflows
gym_id:       text
member_id:    text
member_email: text
status:       'active' | 'achieved' | 'failed' | 'timed_out' | 'paused'
current_step: 'step_1'
goal:         text (copied from workflow at start)
context:      jsonb   { memberId, memberName, history, tags, notes }
started_at:   timestamptz
updated_at:   timestamptz
```

### WorkflowEvent (append-only log)
```
id:           uuid
run_id:       fk → workflow_runs
step_id:      text
event_type:   'step_started' | 'outreach_sent' | 'reply_received' | 'branch_taken' 
              | 'integration_fired' | 'goal_achieved' | 'step_failed' | 'run_timed_out'
payload:      jsonb
created_at:   timestamptz
```

---

## Step kinds

### outreach
Send a message to the member. Agent drafts based on context + goal.
```json
{
  "channel": "email | sms",
  "playbook_id": "uuid (optional — use playbook prompt)",
  "prompt_override": "...",
  "wait_for_reply": true,
  "reply_timeout_days": 5,
  "on_reply_positive": "step_2",
  "on_reply_negative": "step_3",
  "on_no_reply": "step_4"
}
```

### wait
Pause N days before advancing.
```json
{ "days": 3, "then": "step_2" }
```

### branch
AI decides which branch to take based on current context.
```json
{
  "question": "Has the member responded positively to outreach?",
  "branches": [
    { "label": "Yes — positive reply", "next": "step_book_session" },
    { "label": "No — negative or none", "next": "step_follow_up" },
    { "label": "Already came back", "next": "goal_achieved" }
  ]
}
```

### integration
Fire a webhook or integration at a waypoint.
```json
{
  "type": "pushpress_tag | zapier | make | slack_notify",
  "config": { ... }
}
```
Examples:
- `pushpress_tag` → add "Win-Back" tag to member in PushPress
- `zapier` → POST to a Zapier webhook URL with member context
- `slack_notify` → send message to gym owner's Slack

### internal_task
Surface a to-do for the gym owner. Pauses workflow until marked done.
```json
{
  "title": "Call {memberName} — they mentioned a billing issue",
  "assignee": "owner",
  "on_done": "step_2"
}
```

### owner_alert
Non-blocking notification to owner. Continues workflow automatically.
```json
{
  "message": "{memberName} booked a session — heads up!",
  "on_sent": "step_2"
}
```

---

## Example workflows

### 1. Lapsed Member Win-Back
```
Goal: Get the member back through the door

step_1 (outreach, email)
  → positive reply → step_2
  → negative reply → step_close
  → no reply in 5 days → step_sms

step_sms (outreach, sms)
  → positive → step_2
  → no reply in 3 days → step_close

step_2 (integration: pushpress_tag "Win-Back")
  → step_3

step_3 (owner_alert: "{name} is coming back — give them extra attention")
  → goal_achieved
```

### 2. Trial → Paid Conversion
```
Goal: Convert trial member to paying membership

step_1 (wait, 3 days after trial start)
  → step_checkin

step_checkin (outreach: "How's the first week going?")
  → positive → step_offer
  → negative → step_feedback
  → no reply → step_nudge

step_offer (outreach: "Ready to make it official? Here's what members get...")
  → positive → step_tag_convert
  → negative → step_close

step_tag_convert (integration: pushpress_tag "Converted")
  → step_zapier (fire CRM update)
  → goal_achieved
```

### 3. New Member Onboarding (Coach task)
```
Goal: Coach completes 1:1 check-in within first week

step_1 (internal_task: "Schedule 1:1 intro call with {name}")
  → on_done → step_2

step_2 (outreach: "Your coach {coachName} will reach out this week!")
  → step_3

step_3 (wait: 7 days)
  → step_check

step_check (branch: "Did coach complete the check-in?")
  → yes → goal_achieved
  → no → step_alert

step_alert (owner_alert: "Reminder: {name}'s intro call hasn't happened yet")
  → step_3 (loop back, wait another 7 days)
```

---

## Agent behavior

At each step, the workflow runner:
1. Loads the `workflow_run` (current step + full context + event log)
2. Executes the step (send email, fire webhook, evaluate branch, etc.)
3. Logs a `WorkflowEvent`
4. Advances `current_step` based on outcome
5. If `goal_achieved` → marks run as achieved, calculates ROI

For `outreach` steps with `wait_for_reply: true`:
- Creates an `agent_action` row with reply token (existing system)
- Reply webhook advances the workflow when a reply arrives
- `wait_for_reply_timeout` handled by a cron job that checks stalled runs

---

## DB schema (new tables)

```sql
CREATE TABLE workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id text,  -- NULL = system template
  name text NOT NULL,
  goal text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}',
  steps jsonb NOT NULL DEFAULT '[]',
  timeout_days int NOT NULL DEFAULT 30,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id),
  gym_id text NOT NULL,
  member_id text NOT NULL,
  member_email text NOT NULL,
  member_name text,
  status text NOT NULL DEFAULT 'active',  -- active|achieved|failed|timed_out|paused
  current_step text NOT NULL,
  goal text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  achieved_at timestamptz,
  action_id text  -- link to agent_actions row for current outreach step
);

CREATE TABLE workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow_runs(id),
  step_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX workflow_runs_gym_id_status_idx ON workflow_runs(gym_id, status);
CREATE INDEX workflow_runs_member_email_idx ON workflow_runs(member_email);
CREATE INDEX workflow_events_run_id_idx ON workflow_events(run_id);
```

---

## Build order

1. **DB schema** — create tables above in Supabase
2. **`lib/workflow-runner.ts`** — core step executor
3. **`lib/reply-agent.ts`** — hook: on reply, advance workflow instead of standalone action
4. **`/api/workflows/*`** — CRUD for workflow templates
5. **`/api/workflow-runs/*`** — list/detail for active runs
6. **`/api/cron/advance-workflows`** — handles wait steps + timeouts
7. **UI: WorkflowsPanel** — visual list of workflow templates
8. **UI: WorkflowRunDetail** — timeline view of a run in progress
9. **UI: WorkflowBuilder** — edit steps (later, can use natural language → AI builds steps)
