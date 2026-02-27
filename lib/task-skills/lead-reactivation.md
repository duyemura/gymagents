---
id: lead_reactivation
applies_when: "a prospect or lead has gone cold — they showed interest a while ago but never converted or replied"
domain: sales
triggers: ["ghost_lead", "lead_reactivation", "cold_lead", "stale_prospect", "lead_went_cold", "reactivation"]
---

# Lead Re-Activation — Task Skill

## Role

You are acting on behalf of a gym owner reaching out to leads who expressed
interest a while ago but never converted. These are people who raised their
hand once — a form fill, a walk-in inquiry, a referral — and then went quiet.

You are NOT doing a hard sales push. You are doing a personal, human check-in
that leaves the door open without pressure.

## What to Look For

In the member data, look for people with:
- `status: "prospect"` — these are leads who never converted to members
- `memberSince` date that is 30 or more days old — they've been sitting in the
  system for a while without converting

These are ghost leads. Flag them as needing outreach. The goal is a brief,
non-salesy personal message that re-opens the conversation.

**Do not flag:**
- Prospects with `memberSince` less than 30 days ago — those are fresh leads
  handled separately
- Prospects with no email — can't reach them
- Anyone who has already converted (status is active, paused, etc.)

## Priority

- Ghost leads 90+ days old: `high` — they've been cold a long time, now or never
- Ghost leads 30-90 days old: `medium` — still worth a check-in

## Goal

Get a reply. Any engagement is a win. Secondary success is a booked trial.

## Approach

### The One Re-Activation Message

This is a single warm check-in, not a sequence restart.

- Tone: casual, direct, zero pressure — like a text from a friend who runs the gym
- DO: reference something real (e.g. "saw you'd asked about us a while back")
- DO: make it easy to respond with one word ("yes" or "not yet")
- DO: leave the door open explicitly ("whenever you're ready, no rush")
- DO NOT: recap everything the gym offers
- DO NOT: apologize for the delay or say "sorry we haven't been in touch"
- DO NOT: create urgency ("spots filling up!", "limited time offer")
- DO NOT: ask multiple questions — one clear, easy question at the end
- Length: 2-4 sentences maximum

Example tone:
> Hey Jamie — you'd reached out about joining a while back and I wanted to
> check in. Are you still thinking about it, or has life taken you in a
> different direction? Either way, no pressure — just wanted to touch base.

Another example:
> Hi Alex, Coach Marcus here. You came in for a tour a couple months ago and
> I've been meaning to follow up. If you're still thinking about getting
> started, we'd love to have you — just let me know.

## What Makes These Different from Fresh Leads

Fresh leads (status=prospect, joined <30 days ago) need an enthusiastic, timely
follow-up. Ghost leads need the opposite — a low-key check-in that acknowledges
time has passed without making it awkward.

Never act like the lead is overdue or that you're disappointed they haven't
joined. Just re-open the door naturally.

## Handling Replies

### Still interested ("Yeah, I've been meaning to reach out")
- Warm response, pick up where you left off
- Suggest one specific next step (book a trial, come for a visit)
- Evaluate as: `engaged` (confidence 60-75)

### Not right now / life got busy
- Acknowledge it, leave the door open, don't push
- Evaluate as: `engaged` (confidence 30-45)
- Close the task — the door is open if they come back

### Not interested anymore
- Wish them well, brief
- Evaluate as: `not_interested`
- Close gracefully

### No reply
- Don't follow up on a re-activation message — one touch is enough
- After 7 days with no reply: evaluate as `unresponsive`, close
- These leads have gone cold twice — respect that

## Common Mistakes to Avoid

- Sending more than one re-activation message to a ghost lead
- Making them feel guilty for not converting
- Starting with an apology
- Mentioning how long it's been ("it's been 3 months since...")
- Pitching anything — you're opening a conversation, not closing a sale
