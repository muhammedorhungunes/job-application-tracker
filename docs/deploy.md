# Deploy

- **API + Postgres + Redis:** Railway, built from this repo via the GitHub integration.
- **Web:** Vercel, built from this repo via the GitHub integration.
- Both redeploy automatically on every push to `main`. CI (`.github/workflows/ci.yml`)
  runs on the same push but does not gate the deploy — check it's green before pushing.

The two sides need each other's URL, so do the steps in this order.

## 1. Railway — API + Postgres + Redis

1. **New Project → Deploy from GitHub repo** → pick this repo.
2. In the project: **+ Create → Database → PostgreSQL**, then again **+ Create → Database → Redis**
   (the BullMQ queue for AI job-posting parsing; the API worker runs in the same service).
3. API service → **Settings**:

   | Setting | Value |
   |---|---|
   | Root Directory | *(empty — repo root, so the pnpm workspace resolves)* |
   | Build Command | `pnpm turbo run build --filter=@job-tracker/api` |
   | Start Command | `pnpm --filter @job-tracker/api start` |
   | Pre-deploy Command | `pnpm --filter @job-tracker/api prisma:deploy` |
   | Healthcheck Path | `/health` |
   | Watch Paths | `apps/api/**`, `packages/**`, `pnpm-lock.yaml` |

   These live in the dashboard on purpose: Railway's `railway.json` (Config as Code)
   is deprecated and stops being read on 2026-12-01, and its replacement
   (`.railway/railway.ts`) needs an extra dependency.

4. API service → **Variables**:

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference variable) |
   | `JWT_ACCESS_SECRET` | output of `openssl rand -base64 48` |
   | `JWT_REFRESH_SECRET` | a **different** `openssl rand -base64 48` |
   | `WEB_ORIGIN` | `https://example.com` for now — fixed in step 3 |
   | `REDIS_URL` | `${{Redis.REDIS_URL}}` (reference variable) |
   | `ANTHROPIC_API_KEY` | an Anthropic API key (backend only — never set it on Vercel) |
   | `RESEND_API_KEY` | a Resend API key — **required** in production (the API refuses to boot without it) |
   | `EMAIL_FROM` | e.g. `Job Tracker <reminders@your-domain>` — must use a domain verified in Resend |

   `PORT` is injected by Railway; don't set it. `JWT_*_TTL` default to 15m / 30d.
   `ANTHROPIC_MODEL` defaults to `claude-opus-5-5`.
   `REMINDER_CRON` / `REMINDER_TZ` / `REMINDER_STALE_DAYS` default to
   `0 9 * * *` / `Europe/Istanbul` / `7` (daily reminder digest at 09:00 Istanbul).

   Resend's docs say a verified domain is required to send ("You must add and
   verify at least one domain to send emails with Resend"), so verify one under
   **Resend → Domains** before setting `EMAIL_FROM`. The default
   `onboarding@resend.dev` sender is for local testing only; exactly which
   recipients it can reach isn't confirmed yet.

5. API service → **Settings → Networking → Generate Domain**.
6. Check `https://<api-domain>/health` returns `{"status":"ok",...}`.

## 2. Vercel — web

1. **Add New → Project** → import this repo.
2. **Root Directory:** `apps/web`. Leave build/install commands on their defaults —
   Vercel detects Turborepo and builds `packages/types` first.
3. **Environment Variables:** `NEXT_PUBLIC_API_URL` = `https://<api-domain>` (no
   trailing slash). It's inlined at build time, so changing it needs a redeploy.
4. Deploy.

## 3. Back to Railway

Set `WEB_ORIGIN` to the Vercel production URL (e.g. `https://<project>.vercel.app`).
It's the API's CORS origin — only the `/health` page calls the API from the
browser; everything else goes through the web server.

## Smoke test (Week 1 definition of done)

On the Vercel URL: register → add an application → edit it → delete it.

## Troubleshooting

- **Pre-deploy fails with `prisma: not found`:** the build pruned devDependencies.
  Move `prisma` from `devDependencies` to `dependencies` in `apps/api/package.json`.
- **Login works but every page redirects to `/login`:** check `NEXT_PUBLIC_API_URL`
  points at the API domain and the web build was redeployed after setting it.
