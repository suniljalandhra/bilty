# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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

The backend domain/persistence foundation exists. Next.js and authentication are planned follow-up slices; no public HTTP API is exposed yet. See README.md and docs/prd.md for current scope. Do not wire the trusted Actor context directly to request-body values.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm check             # Typecheck, domain tests, build
pnpm test              # No database required
pnpm test:docker       # Preferred: isolated PostgreSQL in Docker
pnpm docker:dev        # Development infrastructure
pnpm docker:migrate    # Containerized migration runner
pnpm docker:stop       # Stop without deleting development data
pnpm test:integration  # Low-level: disposable PostgreSQL ONLY; explicit reset opt-in required
pnpm db:migrate        # Requires DATABASE_URL
pnpm build
pnpm typecheck
```

There are no dev/web/lint scripts yet; do not claim a frontend, server or lint run exists.

## Architecture

- Canonical product requirements: docs/prd.md; exact data contract: docs/fields.md.
- Shared serializable types: packages/shared-types/src/index.ts.
- Bilty domain, validation, money and persistence: apps/api/src/modules/bilty/.
- Explicit TypeORM migrations: apps/api/src/database/migrations/; synchronize is disabled.
- Nested e-way/invoice arrays are part of the validated JSONB bilty aggregate and its audit boundary, not standalone public controllers.
- BiltyModule exports a tenant-scoped service for a future authenticated Nest application.
- Future Next.js routes use App Router with (auth) and (dashboard) groups.

## Git Commit Rules

- Commits must be one-liners (no multi-line messages)
- Do not include Co-Authored-By or similar footers
- Use conventional format: `type: short description`
- Examples: `feat: add bilty entity`, `fix: correct user role enum`
