# Job Application Tracker

Track job applications on a Kanban board, paste a job posting to have Claude
fill in the form, get a daily email about applications that have gone quiet,
and see basic stats about how your search is going.

Single-user for now. The plan and scope live in [`docs/roadmap.md`](docs/roadmap.md).

## Stack

| | |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Web (`apps/web`) | Next.js 15 (App Router), React 19, Tailwind, shadcn/ui |
| API (`apps/api`) | NestJS 11, Prisma, PostgreSQL |
| Jobs | BullMQ + Redis |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) |
| Email | Resend (REST API) |
| Shared (`packages/`) | `types` (zod schemas + TS types), `config` (eslint, tsconfig, tailwind) |

## Running locally

Requires Node 20+, pnpm 9 (`corepack enable`) and Docker.

```bash
pnpm install
docker compose up -d                       # Postgres on :5433, Redis on :6380
cp apps/api/.env.example apps/api/.env     # fill in the JWT secrets and ANTHROPIC_API_KEY
cp apps/web/.env.local.example apps/web/.env.local
pnpm --filter api prisma:migrate           # apply migrations
pnpm dev                                   # web on :3000, api on :3001
```

Leave `RESEND_API_KEY` empty in development: reminder emails are then logged
instead of sent.

## Commands

```bash
pnpm dev                           # web + api together
pnpm lint                          # whole workspace
pnpm typecheck                     # tsc --noEmit everywhere
pnpm --filter api test             # backend unit tests (Jest)
pnpm --filter api test:e2e         # backend e2e (Supertest; needs Postgres + Redis)
pnpm --filter web test             # frontend tests (Vitest + Testing Library)
pnpm --filter api prisma:migrate   # create and apply a migration
```

Deployment (Vercel + Railway) is described in [`docs/deploy.md`](docs/deploy.md).

## Architecture decisions

**One zod schema per contract, shared by both sides.** Request bodies,
responses, env vars and AI output are all validated with zod. The schemas live
in `packages/types`, so the API validates input with the same schema the web
form uses, and the web app parses API responses with it too. `any` is not
allowed; unknown data is `unknown` until a schema narrows it.

**Controller → Service → Repository.** Controllers only validate and
delegate. Business logic sits in services, and each module's repository is the
only code that touches Prisma. Pure calculations, such as the stats
aggregation and the reminder "is this due?" rule, live in plain functions so
they can be unit-tested without Nest or a database.

**Soft deletes in one place.** Nothing is hard-deleted. A Prisma client
extension (`apps/api/src/prisma/soft-delete.extension.ts`) turns `delete` into
setting `deletedAt` and filters deleted rows out of reads, so individual
queries don't need to remember to.

**Slow work runs in BullMQ jobs.** AI calls and emails never run inside a
request. Parsing a job posting returns `202` and queues a job, and the web app
polls for the result. Reminders run on a daily BullMQ job scheduler that
queues one digest job per user.

**AI output is untrusted input.** Every Claude call goes through the `ai/`
module. Prompts live in `ai/prompts/`, and token usage is logged on every call
(and stored per parse). The model's output is parsed with zod; if it doesn't
match, the job retries, and the raw output is never shown. Errors that won't
succeed on retry (bad request, auth) fail at once. The API key exists only on
the backend.

**Auth cookies are re-issued on the web origin.** The API issues a JWT access
token and a refresh token as httpOnly cookies. In production the web app and
the API run on different sites, so the browser would treat the API's cookies
as third-party and drop them. Instead the browser only ever talks to the web
app: server components and server actions call the API and re-set its cookies
on the web origin (`apps/web/src/lib/auth-cookies.ts`). Refresh tokens get
their own table so they can be rotated and revoked per device.

**Server components by default.** Data is read in server components, and
mutations go through server actions with `useActionState`. `"use client"` is
used only where it's needed (the drag-and-drop board, the job-posting import).
The stats charts are plain HTML and CSS rendered on the server, with no chart
library and no client JS.

**Reminders fire once per stretch of silence.** An application is "stale"
when it's `APPLIED` or `INTERVIEWING` and hasn't been updated for
`REMINDER_STALE_DAYS`. Sent reminders are logged in their own
`ApplicationReminder` table rather than on `Application`, because writing
there would bump `Application.updatedAt`, which is the very signal the rule
reads. Each email carries a per-user, per-day idempotency key, so a retried
job doesn't send it twice.

**Status history lives in `Activity`.** Creating an application and every
real status change write an `Activity` row in the same nested Prisma write as
the update, so the log can't drift from the application. The statuses are
stored as structured `fromStatus`/`toStatus` columns, not only as display
text, because the stats query reads them: an application "reached" a status
if it's its current one or appears on either end of any history entry.

**Notes and interviews count as follow-up.** Adding a note or scheduling,
moving or cancelling an interview bumps `Application.updatedAt` in the same
transaction, so the stale reminder doesn't nag about an application you're
actively working on. Interviews are their own table (they can be moved or
cancelled); notes are `NOTE` entries in `Activity`, the only kind of history
entry that can be deleted.

**Interview times belong to the browser.** A `datetime-local` input has no
time zone and server actions run in UTC, so the interview form converts the
value to ISO in the browser before submitting, and times are formatted on the
client after hydration (`useIsClient`), not on the server.

**Interview reminders scan instead of scheduling.** An hourly job e-mails
about interviews starting within `INTERVIEW_REMINDER_LEAD_HOURS` (24) rather
than queueing one delayed job per interview, so reschedules and cancellations
need no queue bookkeeping. `Interview.remindedForScheduledAt` records which
time was reminded about; a reschedule makes it differ, so the new time is
reminded again.

**Board filters live in the URL.** Search, status, tech and date filters
are query params on `/applications`, read by the server component and passed
through to `GET /applications`, so a filtered board survives a refresh and can
be bookmarked. The filter bar is a plain `<form method="get">`, so it needs no
client JavaScript. Both sides parse the params with the same zod schema; the
page drops an invalid field instead of failing. Prisma doesn't escape `%` or
`_` in `contains`, so the repository escapes them itself.

**Few dependencies.** New libraries need a reason. Resend is called with
plain `fetch` instead of its SDK, the charts use no library, and drag and drop
(`@dnd-kit/core`) was added only after it was agreed on.

### Known limitations

- **Status history starts in Nov 2026.** Applications created earlier got a
  backfilled "Added" entry with an unknown initial status; changes made before
  then aren't known, so stats can undercount for those applications.
- **Reminder e-mails use one time zone.** Interview times in reminder
  e-mails are shown in `REMINDER_TZ` (Europe/Istanbul), since the server
  doesn't know each user's zone. Fine for a single user; a per-user zone
  setting would be needed for more.
- **Tech filter is case-sensitive.** Tech stack entries are stored as typed,
  so "React" and "react" are separate filter options.
- **Not deployed yet.** The Railway deploy is on hold while Railway has new
  signups paused (see the roadmap).
