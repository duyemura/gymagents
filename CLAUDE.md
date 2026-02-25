# GymAgents — Claude Instructions

AI General Manager for boutique gyms. Increases retention + revenue through proactive agent execution. Built for PushPress gyms.

## Commands

```bash
npm run dev          # dev server → localhost:3000
npm run build        # production build
npm run test         # vitest run (all tests)
npm run test:watch   # vitest watch mode
npm run lint         # eslint
```

**Never start the dev server.** The user runs `npm run dev` themselves. Do not spin it up to test things — use `npm run build` or `npm run test` to validate changes instead.

## Vision & North Star

Read `docs/VISION.md` before making architectural decisions. Key points:
- **North star:** members retained per gym per month — every decision maps to this
- **The owner's job:** approve or escalate — agents handle everything else
- **Distribution:** PushPress partnership is the growth path, not direct acquisition
- **The demo** is the top of funnel — visitor gets a real email in their inbox in 30s

## Tech Stack

- **Framework:** Next.js 14 App Router
- **Database:** Supabase (Postgres), `gym_id` scoped everywhere
- **AI:** Anthropic Claude — `claude-sonnet-4-6` for reasoning, `claude-haiku-4-5-20251001` for drafting/humanizing
- **Email:** Resend (outbound + inbound webhooks)
- **Deployment:** Vercel — push to `main` → auto-deploy
- **Tests:** Vitest — TDD on all agent classes

## Project Structure

```
app/api/              # API routes (agents, autopilot, webhooks, demo, skills...)
app/dashboard/        # Main UI pages
components/           # React components
lib/agents/           # BaseAgent, GMAgent, RetentionAgent
lib/db/               # DB helpers (commands, events, chat, kpi, tasks)
lib/__tests__/        # All tests live here
lib/workflow-runner.ts
lib/reply-agent.ts
lib/pushpress-sdk.ts
lib/supabase.ts
BRAND.md              # Design system — READ before writing any UI code
WORKFLOWS.md          # Workflow engine design doc
```

## Architecture Patterns

- **Multi-tenancy:** All DB queries must be scoped with `gym_id`
- **Command bus:** Structured commands (`SendEmail`, `SendSMS`, `CreateTask`, `CloseTask`, `EscalateTask`, `EnrollInWorkflow`) — logged, retryable, auditable. See `lib/db/commands.ts`
- **Event bus:** Postgres outbox pattern (no Kafka/Redis)
- **Workflow engine:** TypeScript state machine configs in DB; see `WORKFLOWS.md`
- **Reply loop:** Every outbound email has `Reply-To: reply+{actionId}@lunovoria.resend.app` — inbound webhook routes replies to `lib/reply-agent.ts`
- **Agent hierarchy:** GM Agent → Retention Agent, Sales Agent
- **Demo mode:** Sandboxed per-session, gate via `DEMO_MODE` env var

## UI Rules (from BRAND.md)

**Read BRAND.md before writing UI.** Key rules:
- **No border-radius** on cards, inputs, buttons (hard rule — aesthetic is sharp/futuristic)
- **No drop shadows** (`shadow-*`)
- Primary color: `#0063FF` (pacific-blue)
- Sidebar bg: `#111827`, center bg: `#F8F9FB`
- Buttons: `hover:opacity-80` only — never change background color on hover
- Text: use `text-xs`, `text-sm`, `text-[10px]` — never `text-[11px]`
- Micro-labels: `text-[10px] font-semibold tracking-widest uppercase text-gray-400`
- Focus: `focus:outline-none focus:border-blue-400` (no `focus:ring`)

## Testing

Tests live in `lib/__tests__/`. Agent classes are TDD. Run `npm run test` before finishing any agent/lib changes.

## Environment Variables

See README.md for full list. Key ones: `NEXT_PUBLIC_SUPABASE_URL`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `DEMO_MODE`.

## Supabase Project

Project ID: `pmbqyetlgjnrpxpapfkf`
Live URL: `https://app-orcin-one-70.vercel.app`

## Model Watchdog

Current model: **Sonnet 4.6** (default). Before starting any task, assess complexity and suggest a model change if warranted. Always say which model you recommend and why — don't just proceed silently.

**Switch to Opus 4.6** (`/model` → opus) when the task involves:
- System architecture decisions with competing tradeoffs
- Debugging a non-obvious, multi-layer bug with unclear root cause
- Designing a new agent, workflow engine, or data model from scratch
- Security-sensitive decisions (auth, multi-tenancy, data isolation)
- Anything where you find yourself making multiple assumptions or feeling uncertain about the right approach
- Cross-cutting refactors that touch 5+ files with interdependencies

> Say: _"This task is complex enough that I'd recommend switching to **Opus 4.6** before we proceed — it'll reason better on tradeoffs here. Use `/model` to switch."_

**Suggest Haiku 4.5** (`/model` → haiku) when the task is:
- A single, well-defined edit (rename, typo fix, add a comment, swap a color)
- Generating boilerplate from a clear template
- A simple factual question about the codebase
- Formatting or trivial refactor in one file with no logic change

> Say: _"This is a simple task — consider switching to **Haiku 4.5** to save tokens. Use `/model` to switch."_

**Stay on Sonnet 4.6** for everything in between: standard feature work, most bug fixes, writing tests, code review, explaining code.

## Skills

Installed skills live in `.agents/skills/` (symlinked into `.claude/skills/`).

**Rules:**
- Before starting a specialized task (marketing, SEO, AI pipelines, testing, design, etc.), check `.agents/skills/` for a relevant skill first
- If a skill is already installed, use it via the `Skill` tool and explicitly say so: _"Using the `skill-name` skill for this."_
- If no skill exists but the task is specialized, run `npx skills find [query]` and say: _"Searching for a skill that might help with this."_
- Before installing any skill, say: _"Found `skill-name` — installing it now."_ and confirm with the user first
- Never silently use or install skills — always announce it in the response text
