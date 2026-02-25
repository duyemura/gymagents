# GymAgents — Vision, Strategy & Architecture

_Why this exists, what we're building, and how every decision connects back to the mission._

---

## The Single Sentence

**GymAgents is the AI General Manager every boutique gym needs but can't afford to hire — the only one with complete visibility from the moment a lead clicks an ad to the moment a member walks out the door forever.**

---

## The YC Thesis: Full-Stack AI Companies

Y Combinator's current thesis — explicitly stated in their 2025 Requests for Startups — is that the next wave of important companies will not *sell software to service businesses*. They will *become the service business*, powered by AI:

> "Instead of building services businesses to help human-powered industries, YC wants startups to form autonomous companies that supplant the human labor required by many industries today."

Traditional agencies run 15-30% net margins and grow by hiring. A full-stack AI agency runs 60-80%+ margins and grows by running more instances. The model works because you charge for *outcomes* (members retained, leads converted), not software seats.

YC's Lightcone podcast: *"Vertical AI agents could be 10x bigger than SaaS."* Nearly half of YC's 2025 batch are AI agent companies. Sam Altman's "one-person unicorn" framing is the destination — a small team delivering the output of a 50-person agency.

**Boutique gyms are the perfect target:** high unit economics per member, fragmented incumbent tools, time-poor operators who want outcomes not dashboards, and a platform (PushPress) that already owns the data and the relationship.

---

## The Problem: Gyms Are Buying Fragments of an Answer

A serious boutique gym (100-500 members) today runs a stack like this:

| What They're Buying | Who From | Monthly Cost |
|---|---|---|
| Gym management + booking | PushPress / Mindbody / Wodify | $159 – $449 |
| CRM + lead nurture | Gym Lead Machine / PushPress Grow | $329 – $375 |
| Paid ads management | Local agency | $1,500 – $3,000 |
| Email marketing | Mailchimp / ActiveCampaign | $50 – $300 |
| Social media management | Freelancer or agency | $500 – $2,000 |
| SEO | Agency or tool | $500 – $3,000 |
| Reputation / reviews | Widewail / Score My Reviews | $100 – $300 |
| Business coaching | Two-Brain / Loud Rumor | $500 – $2,000 |

**Total: $4,500 – $14,500/month** — and none of it talks to each other.

The ads agency drives leads. The CRM nurtures them. The gym management system knows who's attending. No single vendor sees the full picture. No one is accountable for the actual outcome. The feedback loop is broken by design.

The result: gyms lose 3-5% of members every month to churn they never saw coming. Industry data: nearly 50% of new members quit within 6 months. The average gym CAC is $118-300. Retaining existing members is 5x cheaper than acquiring new ones — yet almost nothing in the current stack is optimized for retention.

---

## Why PushPress Is the Distribution Moat

PushPress is the operating system for **5,000+ boutique gyms** (CrossFit, BJJ, yoga, pilates, functional fitness). They own:
- The source of truth for every member event (check-in, payment, enrollment, cancellation)
- The trust relationship with gym owners
- The gym's entire operational context

Every competitor has to beg for data access and fight incomplete integrations. GymAgents receives every PushPress event via webhook in real time. We know when Alex missed his third class before anyone else does — and we act on it immediately.

**The partnership thesis:** GymAgents makes PushPress gyms more successful. More successful gyms stay on PushPress longer. This is a natural co-sell / bundle — not a competition. At 5,000+ gyms, even 10% penetration is 500 paying customers before a single cold outreach.

---

## The Unified AI Agency: One Vendor, One Outcome

GymAgents replaces the fragmented stack with a single system accountable for one thing: **revenue retained and grown**.

| Job to Be Done | Agent | Status |
|---|---|---|
| Detect at-risk members + score churn risk | GM Agent | ✅ Live |
| Re-engage lapsed members via conversation | Retention Agent | ✅ Live |
| Win back cancelled members (3-touch sequence) | Win-Back (GM Agent) | ✅ Live |
| Auto-send without owner approval | Autopilot Mode | ✅ Live |
| Attribute retained members to agent actions | Attribution Cron | ✅ Live |
| Daily owner email with activity summary | Daily Digest | ✅ Live |
| Retention dashboard + ROI scorecard | Dashboard | ✅ Live |
| Work new leads + trial conversion | Sales Agent | 🔲 Next |
| Onboard new members (first 30 days) | Onboarding Agent | 🔲 Roadmap |
| Prevent payment embarrassment | Payment Recovery Agent | 🔲 Roadmap |
| Fill underbooked class slots | Fill Agent | 🔲 Roadmap |
| Manage Google reviews + reputation | Reputation Agent | 🔲 Roadmap |
| Drive member referrals | Referral Agent | 🔲 Roadmap |
| Brief coaches on who needs attention | Coach Briefing | 🔲 Roadmap |

The owner's job collapses to two things: **approve messages, handle escalations**. Autopilot mode removes even the approvals.

The key architectural insight: **an agency that controls lead gen + lead nurture + appointment setting + onboarding + retention + win-back produces categorically better results than any combination of point-solution vendors** — because it has full context at every step and can learn from outcomes across all of them.

---

## What's Built

### Agent Layer
- [x] **GM Agent** — churn risk scoring, insight analysis, event-triggered reactions (cancellation, pause, no-show), win-back task creation with member tenure/revenue context
- [x] **Retention Agent** — full reply loop. Claude evaluates every inbound reply and decides: send another message, close as retained, or escalate to owner.
- [x] **Win-back flow** — cancellation triggers a high-priority 3-touch sequence (immediate, day 3, day 10). Different prompt tone: acknowledges the cancellation, no discounts, leaves the door open. Closes as churned after 3 unanswered touches.
- [x] **Message drafting** — Claude drafts coach-voice messages personalized to each member's situation. Separate prompts for retention vs. win-back. Humanizer pipeline (Claude Haiku) runs before any message ships.

### Autopilot & Pipeline
- [x] **Autopilot mode** — per-gym toggle with 7-day shadow period. During shadow mode, tasks still require approval so the owner can build trust. After shadow: agent sends up to 10 messages/day automatically.
- [x] **Safety rails** — escalations and critical-priority tasks always require human approval regardless of autopilot. Daily send cap of 10. Shadow mode enforced for first 7 days.
- [x] **Command bus** — `SendEmail`, `CreateTask`, `CloseTask`, `EscalateTask`, `EnrollInWorkflow`. Every action logged, retryable, auditable. Cron processes every 60s.
- [x] **Workflow engine** — multi-step state machine configs in DB. Natural language → AI → structured `WorkflowDefinition`.

### Attribution & ROI
- [x] **Outcome attribution** — daily cron checks PushPress checkins API for members who received outreach. If member checks in within 14 days of outreach → `outcome = engaged`, attributed value = gym's avg membership price. Window expires with no checkin → `outcome = unresponsive`.
- [x] **Win-back attribution** — when a cancelled member reactivates (detected via PushPress webhook), the system finds the win-back task and sets `outcome = recovered` with `attributed_value = membership * 3` (multi-month recovery value).
- [x] **Monthly ROI rollup** — `getMonthlyRetentionROI()` aggregates: tasks created, messages sent, members retained, revenue retained, members churned, active conversations, escalations. Powers the dashboard scorecard.
- [x] **Configurable membership value** — gym owner sets their avg monthly membership price in Settings. Used for all ROI calculations. Falls back to $150.

### Dashboard & UI
- [x] **Retention scorecard** — hero numbers at top of dashboard: Members Retained, Revenue Saved, Conversations Active, Needs Attention. Fetches from `/api/retention/scorecard`.
- [x] **To-do list** — pending tasks ranked by priority. Click to expand → see risk reason, drafted message, member context. One-tap "Mark Done" (approve + send) or "Dismiss".
- [x] **Activity feed** — timeline of recent events: outreach sent, member replied, member retained, escalation. Outcome badges color-coded (green = retained, red = churned, blue = in progress, amber = escalated).
- [x] **Member risk list** — `/dashboard/members` shows all tracked members with risk level, status, outcome. Filter tabs: All | At Risk | Active | Retained.
- [x] **Settings panel** — autopilot toggle with shadow mode status, membership value editor, PushPress/Gmail integration management, billing/plan management.

### Infrastructure
- [x] **PushPress webhook** — auto-registers on gym connect, stores + routes all events (checkin, cancellation, pause, enrollment, payment, no-show)
- [x] **Resend inbound** — reply routing via `reply+{taskId}@` address, body fetch, quote stripping
- [x] **Daily digest** — morning email to gym owner: pending task count, escalation alerts, monthly retention stats, one-click link to dashboard. Only sends when there are items needing attention.
- [x] **Demo mode** — PLG flow: visitor enters name/email, sees personalized dashboard with themselves as the "at-risk member", gets a real email in their inbox in 30 seconds
- [x] **Stripe billing** — free/starter/pro tiers, checkout flow, customer portal, 14-day trial
- [x] **E2E test suite** — 14 Playwright tests covering dashboard, members, and settings flows. 209 Vitest unit tests covering all agent logic and API routes.

## What's Next (Priority Order)

- [ ] **SalesAgent** — lead nurture + trial conversion (same architecture as RetentionAgent)
- [ ] **Onboarding Agent** — structured first-30-day check-in program (highest churn window)
- [ ] **Payment Recovery Agent** — friendly outreach before the member notices the failure
- [ ] **SMS via Twilio** — second channel for higher-urgency outreach
- [ ] **Cross-gym learning** — aggregate anonymized outcome data across gyms to improve message effectiveness
- [ ] **Reputation Agent** — trigger Google review requests at milestone moments
- [ ] **Fill Agent** — target members for underbooked class slots
- [ ] **Referral Agent** — prompt referral asks at the right moments
- [ ] **Coach Briefing** — daily digest for coaches: who's coming in today that needs attention

---

## Agent Architecture

### Class Hierarchy
```
BaseAgent (DI — no hardcoded external deps, fully testable)
  ├── GMAgent          — analyst + dispatcher + win-back
  │     scoreChurnRisk()         pure scoring, no side effects
  │     analyzeGym()             produces GymInsight[]
  │     runAnalysis()            fetches + analyzes + creates tasks
  │     handleEvent()            reacts to PushPress webhooks immediately
  │     draftMessage()           Claude writes coach-voice copy (retention + win-back prompts)
  │     _handleStatusChanged()   cancellation → win_back task, pause → churn_risk task
  │     _handleNoShow()          missed appointment → follow-up task
  │
  ├── RetentionAgent   — owns the re-engagement conversation
  │     handleReply()       processes inbound reply, decides next action
  │     evaluateTask()      calls Claude with full conversation history
  │
  └── SalesAgent       — (not yet built) lead + trial conversion
```

### Key Design Decisions
- **Dependency injection everywhere** — no hardcoded Supabase/Resend/Claude in agent classes. Full unit testing without network calls.
- **`agent_task` is the unit of work** — every insight becomes a task with a goal, conversation history, status, and outcome. This is the audit log.
- **Commands are the unit of action** — `SendEmail`, `SendSMS`, `CreateTask`, `CloseTask`, `EscalateTask`. Logged, retryable, auditable.
- **Workflows are multi-step programs** — state machine configs in DB. Natural language → AI → structured `WorkflowDefinition`.

### The Reply Loop
```
outbound email
  Reply-To: reply+{taskId}@lunovoria.resend.app
  ↓
member replies
  ↓
Resend inbound webhook → /api/webhooks/inbound-email → RetentionAgent.handleReply()
  - strips quoted reply text
  - appends to task_conversations
  - calls Claude with full conversation history: reply / close / escalate
  ↓
  reply     → sends next message, stays in awaiting_reply
  close     → engaged (commitment made) or churned (clear no)
  escalate  → surfaces to owner (billing dispute, injury, anger)
```

### Win-Back Sequence
```
PushPress webhook: customer.status.changed (cancelled)
  ↓
GMAgent._handleStatusChanged() → creates win_back task (priority: high)
  - captures: tenure, last checkin, monthly revenue, cancellation timestamp
  - drafts personal message (different prompt: acknowledges cancellation, no discounts)
  ↓
Touch 1: immediate (owner approves or autopilot sends)
  ↓
Touch 2: day 3 (if no reply) — different angle, "anything we could do differently"
  ↓
Touch 3: day 10 (if no reply) — low-pressure final note, "door's always open"
  ↓
No reply after touch 3 → close as churned
Member reactivates → PushPress webhook → outcome = recovered, value = membership × 3
```

### Trigger Model
| Trigger | Example | Handler |
|---|---|---|
| **Cron — analysis** | Scan all members every 6h | `/api/cron/run-analysis` → `GMAgent.runAnalysis()` |
| **Cron — commands** | Process pending commands every 60s | `/api/cron/process-commands` → CommandBus + autopilot sends |
| **Cron — attribution** | Check for member re-engagement daily | `/api/cron/attribute-outcomes` |
| **Cron — digest** | Morning email to owner daily | `/api/cron/daily-digest` |
| **PushPress webhook** | `customer.status.changed` → cancelled | `GMAgent.handleEvent()` → win-back task |
| **Inbound reply** | Member replies to agent email | `RetentionAgent.handleReply()` |

Crons catch gradual drift and handle background processing. Webhooks react instantly to hard events. Inbound replies complete the conversation loop.

---

## Business Model

**PLG → PushPress partnership path:**

| Tier | Price | What It Replaces |
|---|---|---|
| Free | $0 | Hooks owner, proves value |
| Starter | $49/mo | Email tool + basic CRM |
| Pro | $97/mo | Retention tool + email agency |
| Agency | $197+/mo | Full marketing agency retainer |

**The ROI math is undeniable:**
- Average member value: $150/month
- 200-member gym at 3% monthly churn = 6 members/month = $900 bleeding out
- Retain 2 of those 6 = $300/month recovered
- Cost of Pro: $97/month → **net +$203/month, pays for itself in week one**

At the Agency tier, we deliver the equivalent of a $2,000-4,000/month marketing agency at $197/month.

**At scale (PushPress partnership, 5,000+ gyms):**
- 500 gyms at $97/mo = $580K ARR
- 500 gyms at $197/mo = $1.2M ARR
- Before the partnership flywheel activates

---

## Competitive Moat

| Competitor | Gap |
|---|---|
| Gym Lead Machine ($375/mo) | Lead capture only, no AI reasoning, no reply loop, no outcome tracking |
| Keepme ($500+/mo) | Enterprise-only pricing, no PushPress integration, scores but doesn't act |
| PushPress Grow ($329/mo) | Basic automation, no AI, no reply loop — we replace this line item |
| Loud Rumor ($1,500+/mo) | No data access, no retention, expensive, no AI |
| Two-Brain ($500+/mo) | Strategy only, human-paced, no execution |

**None of them have PushPress event access. None of them close the loop from action to outcome.**

### Net-New Capabilities (Not Possible Pre-AI)

1. **Closed-loop ROI attribution** — every message tied to a measurable outcome. No current vendor can show "we retained 23 members worth $3,200 this month."

2. **Cross-gym learning flywheel** — the platform learns from every gym simultaneously. Which message tone works for CrossFit vs. yoga? Which offer converts best in week 1? A 2-person agency cannot compete with this over time.

3. **Proactive coach briefings** — every coach gets a daily AI digest: who's coming in today that hasn't been in a while, who hit a milestone, who's at risk. Turns every coach into a retention machine.

4. **Predictive cancellation prevention** — acting before the member consciously decides to cancel. Keepme claims 95% accuracy at enterprise scale. We bring this to single-location gyms for the first time.

5. **Dynamic offer optimization** — continuously tests offer structures (free trial vs. founding rate vs. intro class) and identifies what converts best for each gym's audience.

---

## North Star Metric

**Members retained per gym per month.**

Every feature decision maps to this. If it doesn't help the agent retain more members or grow gym revenue, it waits.

---

## Vocabulary (use consistently in code + copy)

| Term | Meaning |
|---|---|
| `agent_task` | Unit of work — one insight, one member, one goal. Has status, outcome, conversation history, and attributed value. |
| `insight` | Detected signal (churn risk, payment failure, no-show, cancellation) |
| `draft` | Message Claude wrote, pending owner approval |
| `autopilot` | Mode where agent sends without human approval (per-gym toggle) |
| `shadow mode` | First 7 days of autopilot — shows what would send but doesn't. Builds trust. |
| `workflow` | Multi-step program with branching logic |
| `playbook` | Natural-language description that AI converts to a workflow |
| `reply loop` | Back-and-forth conversation between agent and member via `task_conversations` |
| `outcome` | Result of a task: `engaged`, `recovered`, `churned`, `unresponsive`, `escalated` |
| `attribution` | Linking a retained member back to the agent outreach that caused it. Based on PushPress checkin data. |
| `attributed_value` | Dollar amount credited to an agent action (e.g., $150 for a retained member, $450 for a win-back recovery) |
| `escalation` | Task needing human attention (billing dispute, injury, anger) — never autopiloted |
| `win_back` | Task type for cancelled members. 3-touch sequence with distinct message tone. |
| `scorecard` | Dashboard hero numbers: members retained, revenue saved, conversations, needs attention |
