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

## Commands

```bash
pnpm install       # Install all dependencies
pnpm dev           # Run api and web in parallel
pnpm dev:api       # Run only backend
pnpm dev:web       # Run only frontend
pnpm build         # Build all packages
pnpm lint          # Lint all packages
pnpm typecheck     # Type check all packages
```

## Architecture

- **Shared types:** Interfaces and enums in `packages/shared-types`, imported by both apps
- **Backend modules:** Each entity (Company, User, Invite, Consignor, Consignee, Bilty) has its own NestJS module in `apps/api/src/modules/`
- **TypeORM entities:** Live in `apps/api/src/modules/<name>/entities/`
- **Frontend routes:** App Router with `(auth)` and `(dashboard)` route groups

## Git Commit Rules

- Commits must be one-liners (no multi-line messages)
- Do not include Co-Authored-By or similar footers
- Use conventional format: `type: short description`
- Examples: `feat: add bilty entity`, `fix: correct user role enum`
