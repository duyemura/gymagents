# GymAgents — Product & Go-to-Market

_The AI General Manager every boutique gym needs but can't afford to hire._

---

## What Is GymAgents?

GymAgents is an AI-powered retention and revenue engine built specifically for boutique gyms (CrossFit, BJJ, yoga, pilates, functional fitness). It plugs directly into PushPress — the gym management platform used by 5,000+ gyms — and does the work of a full marketing agency: detecting at-risk members, writing and sending personalized outreach, handling reply conversations, winning back cancelled members, and proving every dollar saved.

The gym owner's job reduces to two things: **approve messages** and **handle escalations**. Turn on Autopilot and the owner's job reduces to zero — the agent runs the retention playbook end-to-end.

---

## Who Is This For? (ICP)

### Primary: The Boutique Gym Owner

- **Size:** 80-500 active members
- **Type:** CrossFit boxes, BJJ academies, yoga/pilates studios, functional fitness, personal training studios
- **Platform:** PushPress (required — GymAgents reads PushPress data via webhook)
- **Profile:**
  - Owner-operator or small team (1-3 staff)
  - Time-poor — coaching classes, running payroll, managing the space
  - Knows members are slipping through the cracks but doesn't have time to chase them
  - Currently spending $2,000-$10,000/month across fragmented marketing tools (CRM, email, lead gen, ads agency, reputation management) — none of which talk to each other
  - Understands retention matters more than acquisition but has no system for it
  - Lives on their phone between classes

### Anti-ICP (Not a Fit)

- Large franchise chains with corporate marketing departments
- Gyms not on PushPress (no data access)
- Gyms under 50 members (not enough volume for AI patterns to add value)
- Owners who want to manually write every message themselves

---

## What Does It Do?

### The Retention Machine

GymAgents runs a continuous loop:

```
PushPress events (check-ins, cancellations, payments, enrollments)
    ↓
GM Agent analyzes patterns — who's slipping? who just cancelled? who's at risk?
    ↓
Creates prioritized tasks with AI-drafted messages
    ↓
Owner reviews and approves (or Autopilot sends automatically)
    ↓
Member replies → AI handles the conversation (reply / close / escalate)
    ↓
Member comes back → system attributes the save in dollars
    ↓
Dashboard shows: "You retained 7 members worth $1,050 this month"
```

### Core Capabilities (Live Today)

| Capability | How It Works |
|---|---|
| **Churn risk detection** | Analyzes check-in frequency trends across all members. Spots the drop from 4x/week to 1x/week before the member consciously decides to leave. |
| **Personalized outreach** | AI drafts coach-voice messages — warm, personal, specific to the member's situation. Not templates. Each message references real behavior ("haven't seen you in 19 days"). |
| **Win-back on cancellation** | Within hours of a cancellation event, the system creates a high-priority task with a personal message. No discounts, no hard sells — genuine and human. 3-touch sequence over 10 days. |
| **Full reply loop** | Every outbound email has a real reply address. When a member responds, Claude evaluates the conversation and decides: send another reply, close as retained, or escalate to the owner. |
| **Autopilot mode** | Flip a switch — the agent sends messages without approval. 7-day shadow mode first (shows what it *would* send but doesn't). 10 message/day safety cap. Escalations always surface for human review. |
| **ROI attribution** | When a member checks back in after outreach, the system ties that save to the message that caused it. Dashboard shows retained members and dollars saved — real numbers, not estimates. |
| **Daily digest** | Morning email to the owner: "3 members need attention. You retained 7 members worth $1,050 this month." One tap to open the dashboard. |
| **Owner dashboard** | Retention scorecard (members retained, revenue saved, active conversations, needs attention), to-do list of pending approvals, activity feed of recent actions and outcomes, full member risk list with filters. |

### Agent Architecture

| Agent | Role | Status |
|---|---|---|
| **GM Agent** | Analyst — scans all members, scores churn risk, creates insight tasks, reacts to PushPress events (cancellations, no-shows, payment failures) | Live |
| **Retention Agent** | Executor — handles the reply conversation loop. Evaluates each member response and decides next action. | Live |
| **Win-Back Agent** | Specialized — triggers on cancellation. 3-touch sequence (immediate, day 3, day 10). Different tone: acknowledges the cancellation directly, leaves the door open. | Live |
| **Sales Agent** | Lead nurture + trial conversion | Roadmap |
| **Onboarding Agent** | First 30 days — highest churn window | Roadmap |
| **Payment Recovery Agent** | Pre-empts failed payment embarrassment | Roadmap |

---

## How Does It Help? The Math.

### The Retention Problem

- Average gym loses 3-5% of members per month to churn
- A 200-member gym at 4% monthly churn = 8 members leaving/month
- Average membership value: $150/month
- That's **$1,200/month bleeding out** — $14,400/year
- Industry data: nearly 50% of new members quit within 6 months
- Acquiring a new member costs $118-300. Retaining one costs almost nothing.

### The GymAgents Impact

Based on the system's design and retention research:

| Metric | Conservative | Moderate | Aggressive |
|---|---|---|---|
| Members saved per month (200-member gym) | 2 | 4 | 6 |
| Revenue retained per month | $300 | $600 | $900 |
| Annual revenue impact | $3,600 | $7,200 | $10,800 |
| Cost of GymAgents (Pro) | $97/mo ($1,164/yr) | $97/mo | $97/mo |
| **Net ROI** | **$2,436/yr** | **$6,036/yr** | **$9,636/yr** |
| ROI multiple | **3.1x** | **6.2x** | **9.3x** |

**The payback math:** Retain just 1 member per month → $150 saved → pays for GymAgents at $97/mo with $53 left over. Most gyms should retain 2-4 members/month with consistent outreach.

### What Replaces What

| What the owner is paying for today | Monthly cost | GymAgents replaces it? |
|---|---|---|
| CRM + lead nurture (Gym Lead Machine / PushPress Grow) | $329-375 | Yes — agents handle outreach and conversation |
| Email marketing tool (Mailchimp / ActiveCampaign) | $50-300 | Yes — messages sent through the system |
| Retention tool (if they have one) | $100-500 | Yes — this is the core product |
| Marketing agency retainer | $1,500-3,000 | Partially — handles retention, win-back, follow-up |
| Reputation management | $100-300 | Roadmap (Reputation Agent) |
| **Total replaceable spend** | **$2,000-4,500/mo** | **Replaced by $97-197/mo** |

---

## Pricing

| Tier | Price | What You Get |
|---|---|---|
| **Free** | $0/mo | 3 agent scans/month. See what the AI finds. Limited sending. |
| **Starter** | $49/mo | 30 scans/month. Full retention agent. Email outreach. |
| **Pro** | $97/mo | Unlimited scans. Autopilot mode. Win-back agent. Full reply loop. Daily digest. Priority support. |
| **Agency** | $197+/mo | Everything in Pro + sales agent + onboarding agent + dedicated support. (Coming soon) |

All plans include a **14-day free trial**. No credit card required to start.

---

## Use Cases

### 1. The Disappearing Regular

**Scenario:** Alex used to come in 4x/week. Over the past 3 weeks, he's down to once. His renewal is in 12 days.

**What GymAgents does:**
- GM Agent detects the attendance drop during the next analysis cycle
- Creates a task: "Alex Martinez — attendance declining, renewal in 12 days"
- Drafts a message: "Hey Alex, Coach here. Noticed you've had a lighter month — totally normal. Your membership renews soon and I want to make sure you're getting value. Want to come in for a free personal session this week?"
- Owner approves with one tap
- Alex replies: "Yeah, been traveling. Back next week!"
- Retention Agent recognizes positive intent → marks as engaged
- Alex checks in 4 days later → system attributes the save: $150/month retained

### 2. The Cancellation Win-Back

**Scenario:** Derek just cancelled his membership after 8 months.

**What GymAgents does:**
- PushPress fires a `customer.status.changed` webhook within minutes
- GM Agent creates a high-priority win-back task immediately
- Drafts a personal message: "Hey Derek, I saw your membership ended. After 8 months, you were a real part of the community here. If anything about the experience wasn't working, I'd genuinely love to hear about it. No pressure at all — just wanted you to know the door's always open."
- If no reply by day 3: follow-up with a different angle
- If no reply by day 10: one final low-pressure note, then closes as churned
- If Derek reactivates his membership: system detects via PushPress webhook → attributes $450 recovery value (3 months)

### 3. The Silent Majority

**Scenario:** A gym owner has 200 members. They know 10-15 by name. The other 185 are a blur.

**What GymAgents does:**
- Every 6 hours, the GM Agent scans all members against check-in data
- Surfaces the 5-10 members who are actually slipping right now — ranked by risk and revenue impact
- Owner opens the dashboard, sees: "YOUR TO-DO: 4 members need attention"
- Each card shows the member's name, what's happening ("no check-in for 14 days"), a drafted message, and one-tap approve
- Owner handles all 4 in under 2 minutes

### 4. Autopilot Mode

**Scenario:** The owner trusts the system and doesn't want to approve every message.

**What GymAgents does:**
- Owner enables Autopilot in Settings
- First 7 days: shadow mode. Dashboard shows "would have sent" messages but doesn't actually send. Owner reviews to build trust.
- After shadow period: agent sends up to 10 messages/day automatically
- Escalations (billing disputes, injuries, angry members) always surface for human review — never autopiloted
- Owner gets a daily digest: "Sent 6 messages yesterday. 2 replies received. 1 member retained ($150)."

### 5. The Paused Member

**Scenario:** Priya pauses her membership — often a precursor to cancellation.

**What GymAgents does:**
- PushPress webhook fires immediately
- GM Agent creates a medium-priority task: "Priya paused. Pauses often precede cancellation."
- Drafts a check-in message — not about the pause specifically, just a genuine "how are things going?"
- If Priya replies with a reason ("had surgery, back in 6 weeks"), the agent marks the task and follows up in 6 weeks

### 6. The No-Show

**Scenario:** A member books a class or appointment and doesn't show up.

**What GymAgents does:**
- PushPress fires a no-show event
- GM Agent creates a task: "Member missed their scheduled session"
- Drafts a friendly follow-up — not guilt-tripping, just checking in
- Especially useful for personal training no-shows where revenue is directly at stake

---

## How to Set It Up

### Step 1: Connect PushPress (2 minutes)

1. Go to the GymAgents login page
2. Click "Connect PushPress"
3. Enter your PushPress API key and company ID
4. GymAgents automatically registers webhooks to receive all member events in real time

### Step 2: First Scan (automatic)

Once connected, the GM Agent runs its first analysis within the hour. It scans all your members' check-in patterns and surfaces anyone who's at risk. You'll see results in the dashboard.

### Step 3: Review Your To-Do List

Open the dashboard. The scorecard at the top shows your retention numbers. Below that, the to-do list shows members who need attention — each with a risk level, context, and a drafted message.

Click a member → review the drafted message → tap "Mark Done" to approve and send, or "Dismiss" to skip.

### Step 4: Set Your Membership Value

Go to Settings → ROI Calculation → set your average monthly membership value. This is used to calculate how much revenue each retained member is worth. Default is $150.

### Step 5: (Optional) Enable Autopilot

Settings → Autopilot Mode → toggle on. The first 7 days are shadow mode — the system shows what it would send without actually sending. After that, it runs autonomously up to 10 messages/day.

---

## How to Verify It's Working

### Dashboard Scorecard

The top of the dashboard shows 4 numbers updated in real-time:

- **Members Retained** — members who checked back in after the agent reached out
- **Revenue Saved** — retained members multiplied by their membership value
- **Conversations** — active reply threads (members who responded)
- **Needs Attention** — tasks requiring your review (escalations + active conversations)

### Activity Feed

The right side of the dashboard shows a timeline:
- "Reached out to Alex M." (outreach sent)
- "Alex replied: Been traveling, back next week!" (inbound reply)
- "Derek checked in after outreach" (attribution — this is a win)

Each event has a timestamp and outcome badge (retained, churned, in progress, escalated).

### Members Page

`/dashboard/members` shows every member the system is tracking:
- Risk level indicator (red = high, amber = medium, gray = stable)
- Current status (open task, awaiting reply, resolved, no action)
- Outcome (engaged, churned, recovered, unresponsive)
- Filter tabs: All | At Risk | Active | Retained

### Daily Digest Email

Every morning, you receive an email: "GymAgents: 3 members need attention." It includes your monthly retention stats and a direct link to the dashboard.

### Verifying the Full Loop

To confirm everything is working end-to-end:

1. **Check the dashboard loads** — scorecard numbers, to-do list, activity feed
2. **Approve a message** — click a to-do item, review the draft, tap "Mark Done"
3. **Check your email** — the member should receive the outreach (check your Resend dashboard for delivery confirmation)
4. **Simulate a reply** — have someone reply to the outreach email
5. **Check the activity feed** — the reply should appear, and the Retention Agent should have responded or escalated
6. **Wait for a check-in** — when the member checks in at the gym, the attribution cron picks it up and marks the task as "retained" with a dollar value

---

## Go-to-Market Strategy

### Phase 1: PushPress Partnership (Primary Channel)

GymAgents is built exclusively for PushPress gyms. The distribution strategy is partnership, not direct acquisition.

**Why PushPress wins:**
- GymAgents makes their gyms more successful → lower churn on PushPress itself
- Natural co-sell / bundle opportunity
- 5,000+ gyms on the platform — even 10% penetration = 500 customers before any marketing spend

**Approach:**
- Integrate into PushPress marketplace / app directory
- Joint case studies with early gyms showing retention lift
- Co-branded webinars: "How AI is changing gym retention"
- PushPress sales team introduces GymAgents during onboarding calls

### Phase 2: PLG Demo Funnel

The demo is the top of funnel. A visitor enters their name and email, and within 30 seconds sees a personalized dashboard with themselves as the "at-risk member" and a real email in their inbox. The demo shows the product working on *them*.

**Conversion path:**
1. Visitor lands on site → enters email for demo
2. Sees the dashboard with their name, a drafted message, and real data
3. Gets a real email in their inbox demonstrating the outreach quality
4. Clicks "Connect Your Gym" → enters PushPress credentials
5. First scan runs → sees real members who need attention
6. Free trial starts → 14 days to prove value

### Phase 3: Content + Community

- **Case studies:** "How [Gym Name] retained 12 members in month one with GymAgents"
- **ROI calculator:** Input your member count and avg membership → see projected savings
- **Gym owner communities:** PushPress Facebook group, CrossFit affiliate forums, boutique fitness subreddits
- **Podcast circuit:** Boutique fitness podcasts (Gym World, Two-Brain Radio, etc.)

### Pricing Anchor

The positioning is not "another SaaS tool at $97/mo." The positioning is:

> "You're paying $2,000-4,000/month for a marketing agency that can't even tell you which members it saved. GymAgents does it for $97/month and proves every dollar."

---

## Competitive Landscape

| Competitor | Price | Gap |
|---|---|---|
| **Gym Lead Machine** | $375/mo | Lead capture only. No AI reasoning, no reply loop, no outcome tracking, no retention focus. |
| **Keepme** | $500+/mo | Enterprise pricing. Scores risk but doesn't act on it. No PushPress integration. |
| **PushPress Grow** | $329/mo | Basic automations, no AI, no reply loop. GymAgents replaces this line item entirely. |
| **Loud Rumor** | $1,500+/mo | Agency model — no data access, no retention, expensive, slow. |
| **Two-Brain Business** | $500+/mo | Strategy coaching only. Human-paced. No execution. |
| **Generic CRM (HubSpot, etc.)** | $50-800/mo | Not built for gyms. No check-in data. No AI. Requires manual work. |

**GymAgents' moat:**
1. **PushPress event access** — no competitor has real-time webhook data from the gym management platform
2. **Closed-loop ROI attribution** — every message tied to a measurable check-in outcome. No one else can say "we retained 23 members worth $3,200 this month"
3. **Cross-gym learning** — the system learns from every gym simultaneously. Which message tone works for CrossFit vs. yoga? Which outreach timing converts? This compounds over time and single-gym tools can't compete with it.

---

## Technical Architecture (For Internal Reference)

- **Stack:** Next.js 14, Supabase (Postgres), Anthropic Claude, Resend (email), Vercel
- **AI Models:** Claude Sonnet for reasoning/analysis, Claude Haiku for message drafting/humanizing
- **Data flow:** PushPress webhooks → event processing → GM Agent analysis → task creation → message drafting → approval/autopilot → outbound email → inbound reply → Retention Agent → outcome attribution
- **Cron jobs:** Analysis every 6h, command processing every 60s, attribution daily, digest daily
- **Multi-tenant:** All data scoped by `gym_id` — strict isolation
- **Command bus:** Every action (send email, create task, close task) is a logged, retryable command

---

## FAQ

**How long until I see results?**
The first scan runs within an hour of connecting. You'll see at-risk members immediately. Retained member attribution shows up within days as members respond and check back in.

**Will members know it's AI?**
No. Messages are drafted in the gym owner's voice — warm, personal, referencing real behavior. They look and feel like a coach checking in. Reply-to addresses route back through the system seamlessly.

**What if the AI says something wrong?**
In approval mode (default), you review every message before it sends. In autopilot mode, there's a 7-day shadow period where you see what it *would* send before it goes live. Escalations (billing disputes, injuries, angry members) are never autopiloted.

**Does it work with gyms not on PushPress?**
Not currently. PushPress webhook access is the foundation — check-in data, membership events, and payment data all come through it. Supporting other platforms (Wodify, Mindbody) is on the long-term roadmap.

**How is this different from just sending email campaigns?**
Email campaigns are one-size-fits-all blasts. GymAgents sends individual, personalized messages based on each member's actual behavior — and then handles the conversation when they reply. It's the difference between a newsletter and a coach who knows your name.

**What's the daily sending limit?**
In autopilot mode: 10 messages per day per gym (safety cap). In approval mode: no limit — you control the pace.

**Can I edit the messages before they send?**
Yes. Every drafted message is editable before approval. You can also dismiss tasks you don't want to act on.
