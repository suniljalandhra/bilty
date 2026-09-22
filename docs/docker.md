# Docker workflow

Follow the doma-backend pattern: infrastructure runs in Docker Compose and TypeScript development/tests run locally through pnpm. Bilty has its own Compose project, volume and ports. No Doma resources are reused or changed.

For first-time `.env` setup, Google sign-in, complete Docker startup, and separate backend/frontend hot reload commands, start with the [README development guide](../README.md#first-time-setup). The full Docker app uses built images; host development provides automatic source reloads.

## Development database

```sh
pnpm docker:dev
pnpm docker:migrate
pnpm docker:stop
```

`docker:dev` starts PostgreSQL 16 with a health check and persistent `bilty_pgdata` volume. Port 55432 is bound only to localhost (override DB_PORT if occupied). `docker:migrate` builds the migration image and applies TypeORM migrations after the database becomes healthy. `docker:stop` stops containers without deleting the development volume. The local-only default credentials are in `.env.example`; they are not deployment credentials.

The image supports both migrations and the Nest API. Copy .env.example to .env and set a random JWT_SECRET. Add Google credentials to enable sign-in; development can start with sign-in disabled. Then run `pnpm docker:api`. Run `pnpm docker:app` for the full application at http://localhost:3001. The API waits for healthy PostgreSQL and a successful migration job; the web service then waits for API readiness. Its readiness URL is http://localhost:3000/health (override API_PORT if occupied). `docker:stop` stops all Bilty services without deleting data. Database-only commands still work without Google credentials.

## Integration tests

```sh
pnpm test:docker
```

The runner creates a unique Compose project and isolated tmpfs-backed PostgreSQL, chooses a free localhost port, waits for health, runs integration tests and removes only its own test containers/network/volumes on completion. It never uses DATABASE_URL or the development database. Docker Desktop must be running; no native PostgreSQL installation is needed.

`pnpm test:integration` is the lower-level escape hatch for an explicitly selected disposable database. It drops/recreates its public schema and therefore requires both BILTY_TEST_DATABASE_URL and BILTY_TEST_ALLOW_RESET=yes. Prefer `test:docker`.

## Scope

No Redis, Kafka or object storage is required for this initial slice. Add infrastructure when a feature needs it. Host development uses Node 22+ and pnpm 10.33.0; the migration image uses Node 22. pnpm-lock.yaml is installed frozen. Do not run development-volume deletion commands as part of routine tests.

## Browser verification

`pnpm test:e2e` starts an isolated Docker database, the real API with a test-only injected Google provider, and the Next.js dev server on ports 3100–3102. Playwright Chromium exercises the complete UI. Install the browser once with `pnpm exec playwright install chromium`. The provider harness lives under apps/api/test and is excluded from the production build. Test resources are stopped and removed afterward.
