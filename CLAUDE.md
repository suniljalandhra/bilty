# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Digital Bilty/GR Platform — a multi-tenant SaaS that digitizes manual "Bilty" (Lorry Receipt) books for transport companies in India.

## Tech Stack

- **Backend:** NestJS + TypeORM + PostgreSQL
- **Frontend:** Next.js (App Router)
- **Package Manager:** pnpm (workspace monorepo)
- **Auth:** Google OAuth + JWT

## Monorepo Structure

```
apps/api/          # NestJS backend
apps/web/          # Next.js frontend
packages/shared-types/  # Shared TypeScript types
```

## Current Implementation Status

The Next.js frontend, authenticated Nest API, Google OAuth/session/invitation services, bilty lifecycle, PDF rendering and revocable PDF sharing are implemented for local V1. See README.md and docs/prd.md for current scope. Do not wire the trusted Actor context directly to request-body values.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm check             # Format, typecheck, API/web tests, production builds
pnpm test              # No database required
pnpm test:docker       # Preferred: isolated PostgreSQL in Docker
pnpm test:e2e          # Isolated browser journeys (Playwright Chromium)
pnpm docker:app        # Build and start the complete web/API/database stack
pnpm docker:dev        # Development infrastructure
pnpm docker:migrate    # Containerized migration runner
pnpm docker:stop       # Stop without deleting development data
pnpm test:integration  # Low-level: disposable PostgreSQL ONLY; explicit reset opt-in required
pnpm db:migrate        # Requires DATABASE_URL
pnpm build
pnpm typecheck
```

`pnpm --filter @bilty/web dev` runs Next locally. `pnpm docker:api` starts the backend only; `pnpm start:api` runs its host build. Prefer `docker:app` for the whole application.

## Architecture

- Canonical product requirements: docs/prd.md; exact data contract: docs/fields.md.
- Shared serializable types: packages/shared-types/src/index.ts.
- Bilty domain, validation, money and persistence: apps/api/src/modules/bilty/.
- Explicit TypeORM migrations: apps/api/src/database/migrations/; synchronize is disabled.
- Nested e-way/invoice arrays are part of the validated JSONB bilty aggregate and its audit boundary, not standalone public controllers.
- BiltyModule exports a tenant-scoped service; app.ts wires it into authenticated HTTP controllers. Preserve the SQL/JSONB schema. PUT requires the complete nested document.
- Next.js routes use App Router with a protected (workspace) group and public login/callback/invite/setup entry points.
- Global Nest AuthGuard plus @Public() metadata control authentication; services enforce live transactional tenant/admin authorization.
- PDF shares store fixed issued snapshots and hashed bearer links; cancellation invalidates every link.
- Test-only Google provider harnesses live under apps/api/test and are excluded from production images. Never add an authentication bypass.

## Git Commit Rules

- Commits must be one-liners (no multi-line messages)
- Do not include Co-Authored-By or similar footers
- Use conventional format: `type: short description`
- Examples: `feat: add bilty entity`, `fix: correct user role enum`
