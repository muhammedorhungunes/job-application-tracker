# Job Application Tracker

A full-stack app that tracks job applications, parses job postings with AI,
and sends reminders. Starts single-user, may become multi-user later.

## Tech stack

- **Monorepo:** pnpm workspaces + Turborepo
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind, shadcn/ui
- **Backend:** NestJS 11, TypeScript, Prisma, PostgreSQL
- **Queue/scheduling:** BullMQ + Redis
- **Auth:** JWT (access + refresh), httpOnly cookie
- **AI:** Anthropic Claude API (`@anthropic-ai/sdk`)
- **Testing:** Jest (unit), Supertest (e2e), Vitest + Testing Library (frontend)
- **Deploy:** Vercel (web), Railway (api + Postgres + Redis)

## Folder structure

```
apps/
  web/          # Next.js
  api/          # NestJS
packages/
  types/        # Shared TS types and zod schemas
  config/       # Shared eslint, tsconfig, tailwind configs
```

## Commands

```bash
pnpm dev                      # web + api together
pnpm --filter api test        # backend unit tests
pnpm --filter api test:e2e    # backend e2e
pnpm --filter web test        # frontend tests
pnpm lint                     # whole workspace
pnpm typecheck                # tsc --noEmit
pnpm --filter api prisma:migrate   # create and apply a migration
```

## Rules

### General
- **Never use `any`.** If the type is unknown, use `unknown` + narrow with zod.
- All external input (API body, query, env, AI output) **is validated with zod**.
- Shared types live in `packages/types`; both sides import from there.
  Don't redefine the same type in two places.
- Comments aren't mandatory; code should be readable. But add a short comment
  when the **why** isn't obvious.
- User-facing text in English, variable/function names in English.

### Backend (NestJS)
- Layer order: `Controller → Service → Repository (Prisma)`.
  Controllers contain no business logic, only validate and delegate.
- Each module lives in its own folder: `applications/`, `auth/`, `ai/`, `notifications/`.
- The Prisma client is accessed **only** from the service/repository layer.
- Errors are thrown using NestJS exception classes (`NotFoundException` etc.),
  never a raw `throw new Error()`.
- Long-running work (AI calls, email) **never runs directly inside the request**;
  it's queued as a BullMQ job.
- Env variables are validated via `ConfigModule` + a zod schema; never access
  `process.env` directly.

### Frontend (Next.js)
- **Server components by default.** `"use client"` is added only when state,
  event handlers, or browser APIs are needed, and as low in the tree as possible.
- Data reads happen in server components; mutations go through **server actions**.
- Use `useActionState` for form state, zod for validation (same schema as the backend).
- `fetch` calls go through `lib/api-client.ts`; no raw fetch inside components.
- shadcn/ui components live under `components/ui/`, custom components under
  `components/`.

### Database
- Schema changes **always** go through a migration: `prisma migrate dev`.
  `db push` is for the prototyping stage only, never on a committed schema.
- Deletes are soft deletes (`deletedAt`), no hard deletes.
- Use `Decimal` for money/numeric fields, `DateTime` (UTC) for dates.

### AI integration
- All Claude API calls are centralized in the `ai/` module, never called from
  elsewhere.
- Model output is **always** parsed with zod; if parsing fails, the job goes
  to retry — raw output is never shown to the user.
- Prompts live in separate files under `ai/prompts/`, not embedded in code.
- The API key lives only on the backend. **Never call the Anthropic API from
  the frontend.**
- Token usage is logged for every call (for cost tracking).

### Testing
- Unit test for every service method that contains business logic.
- E2e tests for the auth flow and critical endpoints.
- Don't call something "done" without tests; when you add a new service
  method, add its test too.

### Git
- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`
- Don't dump a whole dev session into one commit; split into logical pieces.
- `main` is protected; work happens on `feat/...` branches.

## Notes for Claude

- Use **plan mode** before starting a big change, and get the plan approved.
- Read a file before editing it; don't write based on assumptions.
- Ask before adding a library. Solve it with existing dependencies if possible.
- Don't make things up if you don't know; say "I need to verify this" instead.
- Run `pnpm typecheck` and the relevant tests after a change.

## Scope discipline (IMPORTANT)

This project will grow in stages. The following features are **out of scope
for now** — don't add them unless explicitly requested:

- Multi-tenant / team support
- Payments / subscriptions
- Mobile app
- Real-time (WebSocket) features
- LinkedIn/Indeed scraping

Phase 2 doesn't start until Phase 1 is done. Phase definitions live in
`docs/roadmap.md`.
