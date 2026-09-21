# Digital Bilty Platform — Monorepo Setup Design Spec

## Overview

Initialize a pnpm workspace monorepo for the Digital Bilty/GR Platform with NestJS backend, Next.js frontend, and shared TypeScript types package. This spec covers the V1 foundation: project structure, all core entity models, and module scaffolding.

## Goals

- Establish monorepo structure: `apps/api`, `apps/web`, `packages/shared-types`
- Define all seven core entities with strict TypeScript types
- Set up NestJS with TypeORM and module structure
- Set up Next.js with App Router
- Shared types consumable by both apps

## Tech Stack

| Layer | Choice |
|-------|--------|
| Backend | NestJS + TypeORM |
| Database | PostgreSQL |
| Frontend | Next.js (App Router) |
| Package Manager | pnpm (workspace) |
| Language | TypeScript (strict mode) |

## Monorepo Structure

```
bilty/
├── pnpm-workspace.yaml
├── package.json                    # Root scripts, shared devDeps
├── tsconfig.base.json              # Shared TS config
├── .gitignore
├── .env.example
├── apps/
│   ├── api/                        # NestJS
│   │   ├── package.json
│   │   ├── tsconfig.json           # Extends base
│   │   ├── nest-cli.json
│   │   └── src/
│   └── web/                        # Next.js
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.js
│       └── src/
├── packages/
│   └── shared-types/
│       ├── package.json
│       └── src/
│           └── index.ts
└── docs/
```

### Root Configuration

**pnpm-workspace.yaml:**
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**Root package.json scripts:**
- `pnpm dev` — runs api and web in parallel
- `pnpm dev:api` — runs only api
- `pnpm dev:web` — runs only web
- `pnpm build` — builds all packages
- `pnpm lint` — lints all packages
- `pnpm typecheck` — type checks all packages

**tsconfig.base.json:**
- `strict: true`
- `strictNullChecks: true`
- `noImplicitAny: true`
- Target ES2022, module NodeNext

## Shared Types Package

Package name: `@bilty/shared-types`

### Enums

```typescript
export enum UserRole {
  ADMIN = 'admin',
  EMPLOYEE = 'employee',
}

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
}

export enum BiltyStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  CANCELLED = 'cancelled',
}

export enum FreightType {
  PAID = 'paid',
  TO_PAY = 'to-pay',
  BILLED = 'billed',
}

export enum CompanyCreatedVia {
  SELF_SERVE = 'self-serve',
  ADMIN_ONBOARDED = 'admin-onboarded',
}
```

### Interfaces

All interfaces mirror entity shapes without ORM decorators. All IDs are UUIDs (strings). Nullable fields typed as `T | null`.

**ICompany:**
- `id: string`
- `name: string`
- `logoUrl: string | null`
- `themePrimaryColor: string | null`
- `themeAccentColor: string | null`
- `gstin: string | null`
- `address: string | null`
- `bankDetails: string | null`
- `biltyNumberPrefix: string`
- `createdVia: CompanyCreatedVia`
- `createdAt: Date`
- `updatedAt: Date`

**IUser:**
- `id: string`
- `email: string`
- `name: string`
- `role: UserRole`
- `companyId: string`
- `createdAt: Date`
- `updatedAt: Date`

**IInvite:**
- `id: string`
- `companyId: string`
- `email: string`
- `role: UserRole`
- `token: string`
- `status: InviteStatus`
- `expiresAt: Date`
- `createdAt: Date`
- `updatedAt: Date`

**IConsignor / IConsignee (same shape):**
- `id: string`
- `companyId: string`
- `name: string`
- `address: string | null`
- `gstin: string | null`
- `phone: string | null`
- `createdAt: Date`
- `updatedAt: Date`

**IBilty:**
- `id: string`
- `companyId: string`
- `number: string`
- `consignorId: string`
- `consigneeId: string`
- `fromLocation: string`
- `toLocation: string`
- `goodsDescription: string`
- `weight: number | null`
- `freightType: FreightType`
- `freightAmount: number | null`
- `vehicleNumber: string | null`
- `driverName: string | null`
- `driverPhone: string | null`
- `status: BiltyStatus`
- `isEdited: boolean`
- `editedAt: Date | null`
- `createdAt: Date`
- `updatedAt: Date`

**IEwayBill:**
- `id: string`
- `biltyId: string`
- `number: string`
- `createdAt: Date`

## Backend (NestJS) Structure

```
apps/api/src/
├── main.ts
├── app.module.ts
├── common/
│   ├── decorators/
│   │   └── current-user.decorator.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── interceptors/
│       └── transform.interceptor.ts
├── config/
│   └── database.config.ts
└── modules/
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── strategies/
    │   │   ├── google.strategy.ts
    │   │   └── jwt.strategy.ts
    │   └── dto/
    ├── company/
    │   ├── company.module.ts
    │   ├── company.controller.ts
    │   ├── company.service.ts
    │   ├── entities/
    │   │   └── company.entity.ts
    │   └── dto/
    │       ├── create-company.dto.ts
    │       └── update-company.dto.ts
    ├── user/
    │   └── ... (same pattern)
    ├── invite/
    │   └── ...
    ├── consignor/
    │   └── ...
    ├── consignee/
    │   └── ...
    ├── bilty/
    │   └── ...
    └── eway-bill/
        ├── eway-bill.module.ts
        ├── eway-bill.controller.ts
        ├── eway-bill.service.ts
        ├── entities/
        │   └── eway-bill.entity.ts
        └── dto/
```

### Entity Definitions

All entities use:
- `@PrimaryGeneratedColumn('uuid')` for IDs
- `@CreateDateColumn()` and `@UpdateDateColumn()` for timestamps
- Explicit `@JoinColumn` with FK column exposed

**Company Entity:**
- All fields from ICompany
- Relations: `@OneToMany` to User, Bilty, Consignor, Consignee, Invite

**User Entity:**
- All fields from IUser
- `@Column({ unique: true })` on email
- `@ManyToOne` to Company

**Invite Entity:**
- All fields from IInvite
- `@Column({ unique: true })` on token
- `@ManyToOne` to Company

**Consignor Entity:**
- All fields from IConsignor
- `@ManyToOne` to Company
- `@OneToMany` to Bilty

**Consignee Entity:**
- Same as Consignor

**Bilty Entity:**
- All fields from IBilty
- `weight` and `freightAmount` as `decimal(10,2)`
- `@ManyToOne` to Company, Consignor, Consignee
- `@OneToMany` to EwayBill

**EwayBill Entity:**
- All fields from IEwayBill
- `@ManyToOne` to Bilty

### Dependencies (apps/api)

```json
{
  "dependencies": {
    "@nestjs/common": "^10.x",
    "@nestjs/core": "^10.x",
    "@nestjs/platform-express": "^10.x",
    "@nestjs/typeorm": "^10.x",
    "@nestjs/config": "^3.x",
    "@nestjs/passport": "^10.x",
    "passport": "^0.7.x",
    "passport-google-oauth20": "^2.x",
    "passport-jwt": "^4.x",
    "@nestjs/jwt": "^10.x",
    "typeorm": "^0.3.x",
    "pg": "^8.x",
    "class-validator": "^0.14.x",
    "class-transformer": "^0.5.x",
    "@bilty/shared-types": "workspace:*"
  }
}
```

## Frontend (Next.js) Structure

```
apps/web/src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── invite/[token]/page.tsx
│   └── (dashboard)/
│       ├── layout.tsx
│       ├── dashboard/page.tsx
│       ├── biltys/
│       │   ├── page.tsx
│       │   ├── new/page.tsx
│       │   └── [id]/page.tsx
│       ├── consignors/page.tsx
│       ├── consignees/page.tsx
│       ├── team/page.tsx
│       └── settings/page.tsx
├── components/
│   ├── ui/
│   ├── forms/
│   └── layout/
├── lib/
│   ├── api.ts
│   └── auth.ts
├── hooks/
│   └── use-auth.ts
└── types/
    └── index.ts
```

### Dependencies (apps/web)

```json
{
  "dependencies": {
    "next": "^14.x",
    "react": "^18.x",
    "react-dom": "^18.x",
    "@bilty/shared-types": "workspace:*"
  }
}
```

## Implementation Scope

This spec covers initial setup only:

**In scope:**
- pnpm workspace configuration
- Shared types package with all enums and interfaces
- NestJS app with TypeORM configuration
- All entity files with decorators and relations
- Module scaffolding (module, controller, service files — minimal implementation)
- Next.js app with folder structure
- Root scripts for dev/build/lint

**Out of scope (future work):**
- OAuth implementation
- API endpoints (CRUD logic)
- Frontend pages (UI implementation)
- PDF generation
- Database migrations
