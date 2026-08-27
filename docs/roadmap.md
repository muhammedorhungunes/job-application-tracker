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
- Deploy: Vercel (web) + Railway (api + Postgres + Redis)
- GitHub Actions: lint + typecheck + test on push

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

- [ ] Drag & drop library for the Kanban board (Day 6-7)
- [ ] Email provider for reminders (Day 10)
