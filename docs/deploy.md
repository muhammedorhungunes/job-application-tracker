# Deploy

- **API + Postgres:** Railway, built from this repo via the GitHub integration.
- **Web:** Vercel, built from this repo via the GitHub integration.
- Both redeploy automatically on every push to `main`. CI (`.github/workflows/ci.yml`)
  runs on the same push but does not gate the deploy — check it's green before pushing.

Redis is not provisioned yet; it arrives with the BullMQ work on Day 8-9.

The two sides need each other's URL, so do the steps in this order.

## 1. Railway — API + Postgres

1. **New Project → Deploy from GitHub repo** → pick this repo.
2. In the project: **+ Create → Database → PostgreSQL**.
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

   `PORT` is injected by Railway; don't set it. `JWT_*_TTL` default to 15m / 30d.

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
