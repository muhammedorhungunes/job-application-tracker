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

**Day 11-12**
- Tests (unit for service methods, e2e for auth + critical endpoints)
- README: architecture decisions section
- Basic stats charts

## Out of scope until explicitly requested

See `CLAUDE.md` → *Scope discipline*:

- Multi-tenant / team support
- Payments / subscriptions
- Mobile app
- Real-time (WebSocket) features
- LinkedIn/Indeed scraping

## Open decisions (resolve when the relevant day arrives)

- [x] Drag & drop library for the Kanban board (Day 6-7) → `@dnd-kit/core`
- [ ] Email provider for reminders (Day 10)
