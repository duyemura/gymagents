---
name: linear-bug-ticket
description: Write high-quality Linear bug tickets and fix them via the red-green auto-fix pipeline. Every bug fix MUST follow the TDD red-green cycle -- write a failing test first, verify it fails, then fix the code, verify it passes.
triggers:
  - bug
  - bug ticket
  - bug report
  - linear bug
  - file a bug
  - report a bug
  - error report
  - crash report
  - fix bug
  - autofix
---

# Linear Bug Ticket Writing + Auto-Fix Pipeline

Two responsibilities:
1. **Write** bug tickets that an engineer (or the auto-fix pipeline) can pick up and fix without asking questions
2. **Fix** bugs via the mandatory red-green TDD cycle

## The Auto-Fix Pipeline

Bugs in the AGT Linear board go through this pipeline:

```
Bug arrives
    |
1. TRIAGE -- Can I fix this safely?
    |               |
   YES              NO -> label "needs-human", comment why, STOP
    |
2. RED -- Write a failing test that proves the bug exists
    |
   Run test -> MUST FAIL
    |               |
   FAILS           PASSES -> test is wrong, rewrite it
    |
3. GREEN -- Write the minimal fix
    |
   Run test -> MUST PASS
    |               |
   PASSES          FAILS -> fix is wrong, adjust it
    |
   Run ALL tests -> MUST ALL PASS
    |               |
   ALL PASS        SOME FAIL -> fix broke something, investigate
    |
4. SHIP -- Branch, commit, PR, link to ticket
    |
5. REVIEW -- Human reviews PR
```

### The Iron Law for Bug Fixes

```
NO FIX WITHOUT A FAILING TEST FIRST.
NO EXCEPTIONS.
```

If the test passes immediately, it doesn't prove the bug exists. Rewrite the test until it fails for the right reason.

If you fix the code before writing the test, delete the fix. Start over. Write the test first.

### Step-by-Step: Fixing a Bug

Every step includes a **Linear lifecycle hook call**. These are MANDATORY — they document the fix on the ticket so the pipeline is traceable. Import from `@/lib/linear`:

```typescript
import { documentFixProgress, updateIssueState } from '@/lib/linear'
```

You need the Linear issue ID (UUID, not the identifier). Get it from the ticket creation result or look it up.

---

**Step 1: Read the ticket.** Understand the bug from the description, error, screenshot, and context.

**Step 2: Find the code.** Use Grep/Glob to locate the relevant file and line.

**Step 3: Update ticket → In Progress.**

```typescript
await updateIssueState(issueId, 'inProgress')
```

**Step 4: RED -- Write the failing test.**

```bash
# Write the test in the relevant test file
# Example: lib/__tests__/feedback.test.ts

it('rejects screenshot over 2MB', async () => {
  const hugeScreenshot = 'data:image/png;base64,' + 'A'.repeat(3_000_000)
  const res = await POST(makeRequest('POST', {
    message: 'test',
    screenshot: hugeScreenshot,
  }))
  expect(res.status).toBe(201)
  const json = await res.json()
  // Screenshot should be silently dropped, not crash the request
  expect(json.ok).toBe(true)
})
```

**Step 5: Run the test. It MUST fail.**

```bash
npx vitest run lib/__tests__/feedback.test.ts
```

Confirm:
- The test fails (not errors due to syntax/import issues)
- It fails because the bug exists (the behavior is wrong)
- The failure message makes sense

If it passes immediately: your test doesn't capture the bug. Rewrite it.
If it errors: fix the test setup, not the production code.

**Step 6: Document RED on the ticket.**

```typescript
await documentFixProgress(issueId, 'red', {
  testFile: 'lib/__tests__/feedback.test.ts',
  testName: 'rejects screenshot over 2MB',
  output: '<paste the failure output from step 5>',
})
```

**Step 7: GREEN -- Write the minimal fix.**

Change only what's needed. Don't refactor, don't "improve" surrounding code, don't add features.

**Step 8: Run the test again. It MUST pass.**

```bash
npx vitest run lib/__tests__/feedback.test.ts
```

**Step 9: Run ALL tests. They MUST all pass.**

```bash
npx vitest run
```

If any other test fails, your fix broke something. Investigate and adjust.

**Step 10: Document GREEN on the ticket.**

```typescript
await documentFixProgress(issueId, 'green', {
  testFile: 'lib/__tests__/feedback.test.ts',
  testName: 'rejects screenshot over 2MB',
  totalTests: 736,   // from vitest output
  totalPassing: 736,  // from vitest output
})
```

**Step 11: SHIP.**

```bash
git checkout -b fix/AGT-{number}-short-description
git add [specific files]
git commit -m "fix: {description} (AGT-{number})"
git push -u origin fix/AGT-{number}-short-description
gh pr create --title "fix: {description} (AGT-{number})" --body "..."
```

**Step 12: Document PR on the ticket.**

```typescript
await documentFixProgress(issueId, 'pr', {
  prUrl: 'https://github.com/duyemura/gymagents/pull/{N}',
  prTitle: 'fix: {description} (AGT-{number})',
  branch: 'fix/AGT-{number}-short-description',
})
```

**Step 13: CI runs. Human reviews and merges.**

GitHub Actions runs tests on the PR. Once CI passes and the human merges to main, the `notify-deploy` workflow automatically:
- Posts a "Deployed to production" comment on the ticket
- Transitions the ticket → Done

You do NOT need to manually close the ticket.

### Triage: Auto-Fix vs. Needs-Human

**Auto-fixable (proceed):**
- Stack trace points to specific file + line
- TypeError / undefined access / null check -- mechanical fix
- Wrong conditional, off-by-one, missing guard
- UI layout issue (with screenshot, BRAND.md reference)
- Test failure with clear assertion
- API returns wrong status code or shape

**Needs-human (label and stop):**
- Requires database migration
- Security or auth related
- External API behavior change (PushPress, Anthropic, Resend)
- Architecture decision embedded in the fix
- Performance issue (needs profiling)
- Vague report -- no error, no screenshot, no repro
- Fix would change more than 5 files

### Safety Rails

1. **Never push to main.** Always branch + PR.
2. **Tests MUST pass** before creating PR.
3. **Max 5 files** per fix. More = label "needs-human."
4. **Never touch:** `lib/auth.ts`, billing/payments, database migrations, env vars.
5. **If unsure:** label "needs-human" with a comment explaining what you found.

---

## Writing Bug Tickets

### Title

Format: `[area] Short description of the broken behavior`

Rules:
- Area in brackets: `[Dashboard]`, `[Agent Runtime]`, `[API]`, `[Setup]`, `[Chat]`, `[Email]`, `[Cron]`
- Describe the BROKEN behavior, not the fix
- Under 80 characters
- No periods

Good:
- `[Dashboard] Chart shows previous month data after timezone change`
- `[Agent Runtime] Session stuck in waiting_approval after tool rejection`
- `[API] /api/feedback POST returns 500 when screenshot exceeds 2MB`

Bad:
- `Bug in dashboard` (too vague)
- `Fix the chart` (describes fix, not bug)

### Description Template

```markdown
## What happens
One sentence. Specific broken behavior.

## What should happen
One sentence. Correct expected behavior.

## Steps to reproduce
1. Go to [page/feature]
2. Do [action]
3. Observe [broken result]

## Technical context
- **File:** `app/api/feedback/route.ts:45`
- **Error:** `TypeError: Cannot read property 'id' of undefined`
- **Stack trace:** (code block if available)
- **Browser:** Chrome 120 / macOS / 1440x900

## Screenshot
![Screenshot](url)

## Severity
- **Impact:** All users / specific accounts / edge case
- **Frequency:** Always / intermittent / rare
- **Workaround:** Yes/No + description

## Red test sketch
Describe the failing test that would prove this bug exists:
- Test file: `lib/__tests__/[relevant].test.ts`
- Assertion: `expect([what]).toBe([expected])` but currently gets `[actual]`
```

The "Red test sketch" section is unique to this pipeline. It pre-plans the failing test so the auto-fix can start immediately.

### Priority Mapping

| Priority | When |
|---|---|
| **Urgent (1)** | Production down, data loss, security, all users |
| **High (2)** | Core feature broken, no workaround, many users |
| **Normal (3)** | Partially broken, workaround exists, subset |
| **Low (4)** | Cosmetic, edge case, minor inconvenience |

### Labels

Type labels:
- `bug` -- confirmed broken behavior
- `error` -- auto-captured runtime error (needs triage)
- `regression` -- previously worked, now broken

Area labels: `dashboard`, `setup`, `agent`, `api`, `email`, `cron`

Pipeline labels:
- `auto-fixable` -- pipeline can handle this
- `needs-human` -- too complex, risky, or ambiguous for auto-fix

## Converting Feedback to Bug Tickets

When feedback arrives from the widget:

1. **Extract the bug** -- separate frustration from broken behavior
2. **Check metadata** -- screenshot, navigation history, console errors, viewport
3. **Reproduce mentally** -- follow the navigation history
4. **Sketch the red test** -- what assertion would prove this bug exists?
5. **Set severity** -- based on how many users hit this, not how upset one user is

## Test Patterns for This Project

This project uses **Vitest** with these established patterns:

**Mock setup:** Use `vi.hoisted()` for mock refs, `vi.mock()` for module mocks
```typescript
const { mockRef } = vi.hoisted(() => ({
  mockRef: { current: null as any },
}))
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(() => mockRef.current),
}))
```

**Factory functions:** `makeRequest()`, `makeCtx()`, `makeDeps()` for test fixtures

**Chainable Supabase mocks:**
```typescript
function chainable(resolveValue: unknown) {
  const chain: any = new Proxy({}, {
    get(target, prop) {
      if (prop === 'then' || prop === 'catch') return undefined
      if (['limit', 'single', 'maybeSingle'].includes(prop as string)) {
        return vi.fn().mockResolvedValue(resolveValue)
      }
      return vi.fn().mockReturnValue(chain)
    }
  })
  return chain
}
```

**Test file location:** `lib/__tests__/{module}.test.ts`

**Run single file:** `npx vitest run lib/__tests__/{file}.test.ts`
**Run all tests:** `npx vitest run`

## PR Template for Bug Fixes

```markdown
## Bug
[AGT-{n}](linear-url) -- {one-line summary}

## Red test
The failing test that proves the bug exists:
- `{test file}`: "{test name}"
- Asserts: `expect({what}).toBe({expected})`
- Failed because: {why it failed before the fix}

## Root cause
{What was wrong in the code and why}

## Fix
{What was changed and why this approach}

## Verification
- [x] Red test written and verified failing
- [x] Fix applied, red test now passes
- [x] All {N} existing tests still pass
- [ ] Verified visually (if UI bug)

Fixes AGT-{n}
```

## Ticket Creation Pipeline

### Auto-captured errors (primary path)

Client-side errors are auto-captured by `lib/feedback-errors.ts` and sent to `/api/feedback`. The feedback API calls `createFeedbackIssue()` which routes errors with stack traces through the **bug triage engine** (`lib/bug-triage.ts`):

```
Error captured (client) → /api/feedback → createFeedbackIssue()
  → Has stack trace? → buildStructuredTicket() (lib/bug-triage.ts)
    → parseStackTrace() — extracts file/line/function from JS stack
    → classifyArea() — maps file paths to areas: [Dashboard], [API], [Agent Runtime], etc.
    → triageAutoFixable() — determines if auto-fixable vs needs-human
    → buildRedTestSketch() — generates a test template for the failing test
    → Creates Linear issue with full structured description + labels
```

The triage engine produces tickets with:
- **Area-tagged title:** `[Dashboard] TypeError: Cannot read properties of undefined (reading 'map')`
- **## What happens** — the error message
- **## Technical context** — file, line number, function name extracted from stack trace
- **## Stack trace** — project frames only (no node_modules)
- **## Screenshot** — auto-captured DOM screenshot
- **## Navigation** — user's path before the error
- **## Red test sketch** — generated test template targeting the right file/area
- **## Triage** — `auto-fixable` or `needs-human` with reason

Labels are auto-applied: `error` + `auto-fixable`/`needs-human` + area label (`dashboard`, `api`, `agent`, etc.)

### Manual bug reports

When a user manually submits a bug without a stack trace, the simple format is used. To improve these:
- Include the error message or reproduction steps
- If you can capture the console error, include it — the stack trace enables the full triage engine

### API Usage (programmatic)

```typescript
import { createFeedbackIssue } from '@/lib/linear'
await createFeedbackIssue({
  type: 'error',
  message: "TypeError: Cannot read properties of undefined (reading 'id')",
  url: 'https://app-orcin-one-70.vercel.app/dashboard',
  screenshotUrl: 'https://storage.example.com/shot.png',
  metadata: {
    stack: 'TypeError: ...\n    at handleClick (components/Foo.tsx:42:10)',
    viewport: { width: 1440, height: 900 },
    navigationHistory: ['/setup', '/dashboard'],
  },
})
```

### Direct triage (for testing or custom pipelines)

```typescript
import { buildStructuredTicket } from '@/lib/bug-triage'

const ticket = buildStructuredTicket({
  errorMessage: "TypeError: Cannot read properties of undefined (reading 'id')",
  stack: 'TypeError: ...\n    at handleClick (components/Foo.tsx:42:10)',
  pageUrl: 'http://localhost:3000/dashboard',
})
// ticket.title → "[Dashboard] TypeError: Cannot read properties of undefined..."
// ticket.labels → ["error", "auto-fixable", "dashboard"]
// ticket.description → full structured description with red test sketch
```

Or via Linear MCP tools:
```
mcp__claude_ai_Linear__create_issue({
  team: "AGT",
  title: "[Dashboard] Chart shows wrong date range",
  description: "## What happens\n...\n\n## Red test sketch\n...",
  priority: 2,
  labels: ["bug", "dashboard", "auto-fixable"]
})
```
