# Docker workflow

Follow the doma-backend pattern: infrastructure runs in Docker Compose and TypeScript development/tests run locally through pnpm. Bilty has its own Compose project, volume and ports. No Doma resources are reused or changed.

## Development database

```sh
pnpm docker:dev
pnpm docker:migrate
pnpm docker:stop
```

`docker:dev` starts PostgreSQL 16 with a health check and persistent `bilty_pgdata` volume. Port 55432 is bound only to localhost (override DB_PORT if occupied). `docker:migrate` builds the migration image and applies TypeORM migrations after the database becomes healthy. `docker:stop` stops containers without deleting the development volume. The local-only default credentials are in `.env.example`; they are not deployment credentials.

This slice has no HTTP server. Its Dockerfile is a migration/tooling image, not an API deployment image. A future API service should depend on healthy PostgreSQL and completed migrations, as in doma-backend.

## Integration tests

```sh
pnpm test:docker
```

The runner creates a unique Compose project and isolated tmpfs-backed PostgreSQL, chooses a free localhost port, waits for health, runs integration tests and removes only its own test containers/network/volumes on completion. It never uses DATABASE_URL or the development database. Docker Desktop must be running; no native PostgreSQL installation is needed.

`pnpm test:integration` is the lower-level escape hatch for an explicitly selected disposable database. It drops/recreates its public schema and therefore requires both BILTY_TEST_DATABASE_URL and BILTY_TEST_ALLOW_RESET=yes. Prefer `test:docker`.

## Scope

No Redis, Kafka or object storage is required for this initial slice. Add infrastructure when a feature needs it. Host development uses Node 22+ and pnpm 10.33.0; the migration image uses Node 22. pnpm-lock.yaml is installed frozen. Do not run development-volume deletion commands as part of routine tests.
