# Auth Slice Implementation Plan

> Execute task-by-task using superpowers:executing-plans, with failing regression tests before implementation.

**Goal:** Expose the existing bilty service through a tenant-safe authenticated Nest API.
**Architecture:** Add compatible SQL migrations and focused auth, company and party services; reuse the existing bilty domain. Google is an injectable external identity provider. PostgreSQL owns atomic state, invitation and refresh transitions.
**Tech stack:** NestJS, TypeORM, PostgreSQL 16, Zod, Google Auth Library, jsonwebtoken, pnpm, Docker.
**Spec:** ../specs/2026-09-21-auth-slice-design.md

## Global constraints

Preserve foundation data and number counters. synchronize=false. One company per user. Integer paise and serialized dates. Never derive Actor from request input. Seven-day absolute sessions; 15-minute access tokens; single-use ten-minute OAuth state. Public share/PDF/frontend work was subsequently authorized in complete-v1.md; this checklist records the auth portion.

## Task 1: Schema and protocol primitives

Files: database/migrations/1790000000001-AuthTables.ts, database/data-source.ts, modules/auth/{config,tokens,google}.ts; test/auth-unit.test.ts and auth-postgres.test.ts.

- [x] Add tests rejecting invalid configuration, wrong JWT algorithm/audience, expired or forged access tokens and incomplete Google claims.
- [x] Run unit tests and observe missing implementation failure.
- [x] Implement strict configuration, cryptographic helpers, Google provider boundary, additive migration and legacy user backfill.
- [x] Verify migration preserves profiles/counters/bilty data and rollback leaves foundation intact.

Interfaces: AuthConfig from readConfig(env); TokenService.sign(userId,sessionId)/verify(token); GoogleProvider.authorizationUrl(state,nonce,verifier)/exchange(code,verifier,nonceHash).

## Task 2: Login, invitations and sessions

Files: modules/auth/auth.service.ts, modules/company/company.service.ts; test/auth-postgres.test.ts.

- [x] Add real PostgreSQL tests for state binding/replay, verified identity, onboarding races, invite mismatch/replay/cross-company/revoked membership.
- [x] Run isolated Docker suite and observe failures for absent auth behavior.
- [x] Implement beginLogin/finishLogin, current principal resolution, onboarding, create/list/revoke/verify invitation and atomic refresh rotation/logout.
- [x] Test refresh reuse, concurrent rotation, expiry and immediate access revocation; test last-admin and tenant restrictions.

Interfaces: AuthService(db,config,google); authenticate(accessToken) returns Principal {userId,sessionId,companyId|null,role|null}; refresh(token) returns {accessToken,refreshToken,expiresAt}; CompanyService uses live Principal and database rechecks.

## Task 3: HTTP and existing bilty integration

Files: http/{controllers,security,contracts}.ts, app.ts, main.ts, modules/party/party.service.ts, bilty/bilty.service.ts; test/http-postgres.test.ts.

- [x] Add HTTP integration tests for missing bearer, spoofed company, unknown DTO keys, partial PUT, stale versions, Origin checks, cookie flags and fixed callback redirects.
- [x] Add archived-party tests proving old references survive and new references fail.
- [x] Run failures, then add Nest controllers/guard/filter and lifecycle bootstrap with body limits/CORS.
- [x] Add history/print projection and bounded list paging; rerun original domain/persistence suite.

Interfaces: createApp(db,config,google?) returns initialized Nest application without listening; services receive trusted Principal only. Full PUT calls existing edit with complete data and expectedVersion.

## Task 4: Docker, documentation and verification

Files: docker-compose.yml, apps/api/Dockerfile, package scripts, .env.example, README.md, AGENTS.md, CLAUDE.md, docs/prd.md, docs/auth-api.md.

- [x] Add API service depending on healthy postgres and completed migration job; document Google setup and safe local secrets.
- [x] Run pnpm check and pnpm test:docker, then build Docker API image and smoke-test /health on an isolated Compose project.
- [x] Review all changes, fix concrete issues and sync verified changes into the user's repository without touching unrelated files.
- [x] Report exact test results and the external Google credentials/live-login limitation.

## Verified completion — 22 September 2026

Implemented in the repository, with the prior frontend scaffold preserved separately at the user’s request. `pnpm check` passes (26 API/domain/PDF tests and 6 frontend tests, typechecks and production builds); `pnpm test:docker` passes 36 integration tests; `pnpm test:e2e` passes all 5 browser journeys. Docker PostgreSQL/API/web are healthy at ports 55432/3000/3001; migrations are applied. See docs/verification.md for the verification record and live Google setup boundary.
