# Roadmap

Referenced from `CLAUDE.md` → *Scope discipline*. Phase 2 doesn't start until
Phase 1 is fully done and deployed.

## Phase 1 — Two-week plan

### Week 1 — working skeleton, deployed

**Day 1-2**
- Monorepo setup (pnpm workspaces + Turborepo, `packages/types`, `packages/config`)
- Prisma schema: `User`, `Application`, `Company`, `Activity`
- Auth: register / login / refresh, JWT (access + refresh) + httpOnly cookie

**Day 3-4**
- Application CRUD
  - NestJS: controller → service → repository (Prisma)
  - Next.js: list page + detail page

**Day 5**
- Deploy: Vercel (web) + Railway (api + Postgres + Redis) — see `docs/deploy.md`
  - Redis deferred to Day 8-9: nothing uses it until the BullMQ AI jobs
- GitHub Actions: lint + typecheck + test on push
- **Status (2026-11-01):** CI and the deploy runbook are merged; the deploy
  itself is postponed because Railway paused new signups after its 2026-10-21
  incident. Feature work continues locally until signups reopen.

**Definition of done for week 1:** you can add your own application on a live
URL. It doesn't need to look good — it needs to work.

### Week 2 — the part that actually adds value

**Day 6-7**
- Kanban board with drag & drop (applied → interview → offer → rejected)
- Needs a drag & drop library — decide and get sign-off before starting
  (candidate: `@dnd-kit/core`), per the "ask before adding a library" rule.

**Day 8-9**
- AI module: paste a job posting, Claude API extracts company / position /
  tech stack, validated with zod, runs as a BullMQ job
- Prompts live under `ai/prompts/`, not embedded in code
- **Status (2026-11-04):** done on `feat/ai-job-parser`. `POST /ai/job-postings`
  returns 202 and queues a BullMQ job. The web app polls `GET /ai/job-postings/:id`
  and pre-fills the new-application form; nothing is saved without the user.
  Adds `Application.techStack`. Libraries: `@anthropic-ai/sdk`, `bullmq` 5.x
  (bundles ioredis; 6.x doesn't), `@nestjs/bullmq` 11.x (12.x is ESM-only).

**Day 10**
- Cron + email reminders ("no update on application X for 7 days")
- Needs an email provider — decide before this day (candidate: Resend)
- **Status (2026-11-05):** done on `feat/email-reminders`. A BullMQ job
  scheduler runs a scan daily at 09:00 Europe/Istanbul (`REMINDER_CRON` /
  `REMINDER_TZ`) and queues one digest email per user listing `APPLIED` /
  `INTERVIEWING` applications whose `updatedAt` is 7+ days old
  (`REMINDER_STALE_DAYS`). Sends go through `ApplicationReminder` so an
  application is reminded once per stretch of silence, until it's updated
  again. Resend is called over plain `fetch` (no SDK), with an idempotency key
  per user per day; without `RESEND_API_KEY` (dev/test) emails are logged.
  No new libraries.

**Day 11-12**
- Tests (unit for service methods, e2e for auth + critical endpoints)
- README: architecture decisions section
- Basic stats charts
- **Status (2026-11-06):** done on `feat/stats-dashboard`. `GET /applications/stats`
  returns counts by status, applications per week (last 12 UTC weeks, by
  `appliedAt` falling back to `createdAt`), conversion rates, and the stale count
  (same rule as reminders). `/applications/stats` renders it with server-only
  HTML/CSS charts — no chart library. Conversion rates use current status only
  (no status history; `Activity.STATUS_CHANGE` is never written), so they're
  shown as minimums. Test coverage was audited: every business-logic service
  already had unit tests, and auth / applications / ai / notifications have
  e2e tests. `README.md` added with an architecture decisions section.

## Phase 2

Started on 2026-11-08 before the Phase 1 deploy, by the user's decision: the
deploy is still blocked on Railway signups, and all Phase 1 features are
merged. The deploy stays the one open Phase 1 item.

- **Status history**
  - **Status (2026-11-08):** done on `feat/status-history`. Creating an
    application writes an `APPLICATION_CREATED` activity, and every real status
    change writes a `STATUS_CHANGE` activity with new `Activity.fromStatus` /
    `toStatus` columns. Same-status updates (a Kanban card dropped back into its
    own column) add nothing. The migration backfills an "Added" entry with
    unknown status for existing applications. `GET /applications/:id/activities`
    returns the timeline newest first, and the detail page renders it.
    Conversion rates now count every status an application reached (current
    plus both ends of each history entry) instead of current status only.
    No new libraries.

- **Notes and interviews**
  - **Status (2026-11-09):** done on `feat/notes-interviews`. Notes are `NOTE`
    activities, added from the detail page's History section and soft-deleted
    (not editable); only NOTE entries can be deleted. Interviews are their own
    `Interview` model (kind, time, notes) under
    `/applications/:applicationId/interviews`, editable and cancellable (soft
    delete). Scheduling, rescheduling and cancelling write timeline entries;
    kind/notes-only edits don't. Adding a note or changing an interview bumps
    `Application.updatedAt`, so the stale reminder treats it as followed up.
    Interview times are converted to UTC in the browser and shown in the
    viewer's time zone. No new libraries.
- **Interview reminder e-mails**
  - **Status (2026-11-10):** done on `feat/interview-reminders`. An hourly
    BullMQ scan (`INTERVIEW_REMINDER_CRON`) queues one e-mail per interview
    starting within `INTERVIEW_REMINDER_LEAD_HOURS` (24), skipping cancelled
    interviews and REJECTED / WITHDRAWN or deleted applications. The send job
    re-checks before sending; `Interview.remindedForScheduledAt` makes it
    once per interview time, so a rescheduled interview is reminded again.
    Times are shown in `REMINDER_TZ`. Same queue, e-mail sender and retry
    handling as the stale digest. No new libraries.
- **Upcoming interviews**
  - **Status (2026-11-10):** done on `feat/upcoming-interviews`.
    `GET /interviews/upcoming?days=7` (1-30) lists the user's interviews from
    an hour ago through the window, soonest first, with the application and
    company; cancelled interviews and REJECTED / WITHDRAWN or deleted
    applications are left out (same rule as reminders, now shared as
    `ClosedApplicationStatusValues`). The applications page shows them above
    the board when there are any. No schema change, no new libraries.

## Out of scope until explicitly requested

See `CLAUDE.md` → *Scope discipline*:

- Multi-tenant / team support
- Payments / subscriptions
- Mobile app
- Real-time (WebSocket) features
- LinkedIn/Indeed scraping

## Open decisions (resolve when the relevant day arrives)

- [x] Drag & drop library for the Kanban board (Day 6-7) → `@dnd-kit/core`
- [x] Email provider for reminders (Day 10) → Resend, via its REST API (no SDK)
- [x] Chart library for stats (Day 11-12) → none; plain HTML/CSS server components
