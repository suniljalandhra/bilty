# Bilty Digital Platform

A locally runnable digital bilty / goods-receipt application, with a Next.js frontend, NestJS API and PostgreSQL database.

## Implemented V1

- Google sign-in, first-company setup, email-bound invitation links, rotating sessions and immediate membership revocation.
- Company branding/settings, administrator and employee permissions, last-admin protection and an address book with archival.
- Bilty book with server-side search, status/date filters and pagination; complete create/edit/issue/cancel flows and audit history.
- Multiple e-way bill numbers and invoices per bilty, independent weights/CBM, insurance, charges, exact paise totals and atomic numbering.
- Full-document saves with version-conflict reconciliation; immutable issued company snapshots and terminal cancellation.
- Branded A4 and 80 mm PDF download/printing, four copy labels, English/Devanagari text and long-content pagination.
- Expiring, revocable PDF links tied to a fixed issued version, plus a user-controlled WhatsApp compose link.
- Responsive desktop/mobile UI and Docker Compose startup for the complete application.

E-way/invoice document attachments, government verification, email delivery and assisted onboarding remain outside V1. The Claude Design HTML export is a visual reference; production UI source is in `apps/web`.

## First-time setup

Run all commands from the repository root, which contains `package.json`, `pnpm-workspace.yaml` and `docker-compose.yml`. The backend is `apps/api`, the frontend is `apps/web`, and shared contracts are in `packages/shared-types`.

Install Docker Desktop with Compose v2 and keep it running. For host development use Node.js 22.18+ or 24.x and pnpm 10.33.0. If pnpm is missing, install it with `npm install --global pnpm@10.33.0`.

```sh
node --version
pnpm --version
docker compose version
pnpm install --frozen-lockfile
# Create local settings only if they do not already exist.
test -f .env || cp .env.example .env
openssl rand -hex 32
```

For a new setup, copy the generated value into `JWT_SECRET` in the root `.env`; keep an existing configured secret. Keep `NODE_ENV=development` for local HTTP. Add your Google client ID and secret to enable sign-in; the app can start without them but cannot authenticate users. Preserve an existing `.env`; it is ignored by Git. See Google setup below.

## Start the complete application in Docker

```sh
pnpm docker:app
```

This builds both apps, starts PostgreSQL, applies migrations, and waits for API and web readiness. It serves built application images; source edits require running `pnpm docker:app` again. Use the next section for automatic source reloads.

| Service           | Default local address                  |
| ----------------- | -------------------------------------- |
| Frontend          | http://localhost:3001                  |
| Backend readiness | http://localhost:3000/health           |
| PostgreSQL        | localhost:55432, database/user `bilty` |

```sh
# Check services and follow logs.
docker compose --profile app ps
docker compose --profile app logs --follow api web
# Stop Bilty services while preserving the database.
pnpm docker:stop
# Start them again, rebuilding any changed source.
pnpm docker:app
```

All Docker ports bind to localhost. Data lives in the persistent Bilty PostgreSQL volume; routine stop/start does not remove it. More detail is in [Docker setup](docs/docker.md).

## Develop backend and frontend with hot reload

This keeps PostgreSQL in Docker and runs both TypeScript apps locally. Use this workflow when editing both applications.

First prepare the database and shared package from the repository root:

```sh
# If the full Docker app is running, stop it to free ports 3000 and 3001.
pnpm docker:stop
pnpm docker:dev
pnpm docker:migrate
pnpm --filter @bilty/shared-types build
```

In terminal 1, start the backend with automatic reloads and explicit root `.env` loading:

```sh
pnpm --filter @bilty/api exec tsx watch --env-file="$PWD/.env" src/main.ts
```

In terminal 2, from the same repository root, start the frontend:

```sh
NEXT_PUBLIC_API_URL=http://localhost:3000 pnpm --filter @bilty/web dev
```

Open http://localhost:3001 and check http://localhost:3000/health. Keep both terminals running; Ctrl+C stops each app. Use `pnpm docker:stop` when you also want to stop the database. Run `pnpm docker:migrate` after adding/pulling a database migration. Rebuild `@bilty/shared-types` after changing its exported contracts so consumers see updated declarations.

The quoted `$PWD/.env` expands to the root file before the package runner changes directories. The API has no `dev` package script; the explicit `tsx watch` command above is the supported development command. Plain API Node/pnpm commands do not automatically load `.env`. The frontend runs from `apps/web`, so it does not automatically read the root `.env` either: pass `NEXT_PUBLIC_API_URL` as above or set it in an ignored `apps/web/.env.local`. Browser-visible variables must not contain secrets.

For a built backend instead of watch mode:

```sh
pnpm --filter @bilty/shared-types build
pnpm --filter @bilty/api build
node --env-file=.env apps/api/dist/main.js
```

`pnpm start:api` also runs the built backend, but requires the settings to have already been exported into that terminal. Startup does not apply migrations implicitly.

## Develop only the frontend against the Docker backend

```sh
# Free the frontend port if the Docker web service is running.
docker compose --profile app stop web
pnpm docker:api
NEXT_PUBLIC_API_URL=http://localhost:3000 pnpm --filter @bilty/web dev
```

This keeps PostgreSQL, migrations and the API in Docker while Next.js reloads local UI changes. API source edits in this mode require rerunning `pnpm docker:api`. Stop the local frontend before switching back to `pnpm docker:app`.

## Google sign-in and first use

1. Create a Google OAuth web application client for your project, with the exact authorized redirect URI `http://localhost:3000/auth/google/callback`. Configure its consent/test-user access for the accounts you will use.
2. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` privately in the root `.env`. Keep `GOOGLE_CALLBACK_URL` equal to that registered redirect URI and `FRONTEND_URL=http://localhost:3001`.
3. Apply changed settings by rerunning `pnpm docker:app` in Docker mode, or restarting the backend watch command in host mode. Restart the frontend too if its API URL changed.
4. Open http://localhost:3001/login and choose **Continue with Google**. First-time users create their company and become its administrator. Existing employees join through the invitation link from their administrator.

Use `localhost` consistently in your browser and settings; `127.0.0.1` is a different origin for cookie/CORS purposes. There is no seeded password or demo login. Automated tests substitute the external Google provider; live consent must be verified with your own client. `googleConfigured: true` means credentials are present, not that Google has accepted them.

## Environment settings and ports

The root `.env.example` is the template for API and Compose settings.

| Setting                                    | Purpose                                                                                                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET`                               | Required API signing secret; generate with `openssl rand -hex 32`                                                                               |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Required for actual Google sign-in; allowed to be blank only in development/test                                                                |
| `GOOGLE_CALLBACK_URL`                      | Registered OAuth callback, default `http://localhost:3000/auth/google/callback`                                                                 |
| `FRONTEND_URL`                             | Exact browser origin for redirects/CORS/refresh, default `http://localhost:3001`, with no path or trailing slash                                |
| `PUBLIC_API_URL`                           | Public origin for PDF links; also supplies the frontend API URL during Docker builds                                                            |
| `DATABASE_URL`                             | Host API database connection; default uses `localhost:55432`. Compose constructs its internal connection from `DB_*` using `postgres:5432`      |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME`        | Docker database settings; example credentials are for local development only                                                                    |
| `DB_PORT`                                  | Docker PostgreSQL host port, default `55432`; update host `DATABASE_URL` if changed                                                             |
| `API_PORT`, `WEB_PORT`                     | Docker host ports, defaults `3000` and `3001`; do not change the containers' internal ports                                                     |
| `PORT`                                     | Host backend listening port, default `3000`; Compose sets its own internal port                                                                 |
| `NODE_ENV`                                 | Use `development` locally; `production` requires Google credentials and HTTPS URLs                                                              |
| `NEXT_PUBLIC_API_URL`                      | Frontend browser API origin. Pass it to the host Next process or use `apps/web/.env.local`; Compose sets it at build time from `PUBLIC_API_URL` |

If the API port changes, update `PUBLIC_API_URL`, `GOOGLE_CALLBACK_URL`, the registered Google redirect, and the host frontend's `NEXT_PUBLIC_API_URL` together. If the frontend port changes, update `FRONTEND_URL`; for host Next development use `pnpm --filter @bilty/web exec next dev --hostname 0.0.0.0 --port <port>` because its `dev` script defaults to 3001. Rebuild Docker web after changing its public API URL because Next embeds that value in the browser build. Changing database credentials in `.env` does not change credentials already stored in an existing PostgreSQL volume.

## Verification

```sh
pnpm check
pnpm test:docker
pnpm exec playwright install chromium # once per machine
pnpm test:e2e
```

`check` runs formatting, typechecking, database-free tests and production builds. `test:docker` exercises real PostgreSQL migrations, concurrency, tenant isolation, sessions, HTTP and PDF sharing. `test:e2e` runs the real API and Next app against an isolated database and a test-only Google provider. It covers setup, multiple references, issue/edit/cancel, PDF download, share revocation, mobile layout and employee invitations/revocation. Each runner removes only its own temporary resources. Browser Back/Forward protection uses the Navigation API; older browsers retain link and document-unload warnings only. Current Chromium is covered by the browser suite.

`test:integration` is a low-level escape hatch that **drops/recreates the public schema** at BILTY_TEST_DATABASE_URL and requires BILTY_TEST_ALLOW_RESET=yes. Prefer `test:docker`; never select development or production data.

For individual checks use `pnpm --filter @bilty/api test`, `pnpm --filter @bilty/web test`, `pnpm typecheck`, or `pnpm build`. Browser tests require free ports 3100–3102 and install their own temporary database; they can run alongside the normal app on ports 3000/3001.

## Common startup issues

| Symptom                                    | Check or fix                                                                                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Cannot connect to Docker                   | Start Docker Desktop and confirm `docker info` succeeds                                                                                       |
| Port already in use                        | Stop the Bilty Docker service or host process using it; do not run Docker and host apps on the same ports                                     |
| API fails configuration/startup            | Check root `.env`, nonempty `JWT_SECRET`, database availability and the API logs. Host startup must load the file with the documented command |
| Database tables are missing                | Run `pnpm docker:migrate`; API startup deliberately does not synchronize schema                                                               |
| Google button disabled                     | Set the two Google credentials and restart/recreate the API                                                                                   |
| Google rejects the callback                | Match the Google registered redirect URI exactly to `GOOGLE_CALLBACK_URL`, and check the account's consent/test-user access                   |
| Refresh/CORS fails                         | Match the browser origin to `FRONTEND_URL`, including scheme and port; use `localhost` consistently                                           |
| Frontend calls an old API URL              | Restart host Next after changing its env, or rebuild Docker web with `pnpm docker:app`                                                        |
| Share link fails on another phone/computer | A localhost URL only reaches this machine; external sharing requires reachable deployment URLs                                                |

## Architecture and contracts

Nest's global `AuthGuard` validates access tokens and resolves live session/membership state. `@Public()` marks the narrow public routes. Services enforce tenant/admin permissions transactionally; no caller-supplied company or role is trusted. Express middleware handles headers and per-process rate limiting. Access tokens stay in browser memory; refresh cookies are HttpOnly and rotations are coordinated between tabs.

`PUT /biltys/:id` requires `{expectedVersion, data, reason}` with the complete nested document. Stale versions return 409. Archived parties remain valid on existing references but cannot be newly selected. `/print` returns a JSON projection; `/pdf` returns PDF bytes. Shares preserve their creation-time version and stop working on expiry, revocation or cancellation. See the [HTTP guide](docs/auth-api.md).

- [Canonical V1 PRD](docs/prd.md)
- [Field dictionary](docs/fields.md)
- [Auth design](docs/superpowers/specs/2026-09-21-auth-slice-design.md)
- [Complete V1 design](docs/superpowers/specs/2026-09-21-complete-v1-design.md)
- [Implementation checklist](docs/superpowers/plans/2026-09-21-complete-v1.md)
- [Verification record](docs/verification.md)
- [Claude Design handoff](docs/prototype-handoff.md)

Public deployment is separate from local completion. Set public HTTPS URLs and same-site frontend/API hosting, verify Google consent, configure database backups and least-privilege roles, and use a shared gateway limiter before running multiple API instances. Localhost share links work only on this computer. Legacy membership IDs remain identity-less until a trusted reconciliation links them; never claim them by matching email automatically.
