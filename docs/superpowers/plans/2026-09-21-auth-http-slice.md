> Superseded during implementation by [the tested auth plan](2026-09-21-auth-slice.md) and [complete V1 plan](2026-09-21-complete-v1.md). This earlier proposal is retained for history; do not implement its code samples over the current services.

# Auth & HTTP Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google OAuth authentication, stateful refresh sessions with rotation, employee invitations, and HTTP controllers for biltys/parties.

**Architecture:** Passport Google OAuth strategy, raw SQL services matching existing patterns, NestJS guards and controllers, JWT access tokens with rotating refresh tokens in httpOnly cookies.

**Tech Stack:** NestJS 11, passport-google-oauth20, @nestjs/jwt, @nestjs/passport, TypeORM raw queries, PostgreSQL, zod validation.

**Spec:** ../specs/2026-09-21-auth-slice-design.md

## Global Constraints

- Preserve existing JSONB columns (profile, snapshot, data)
- Use raw SQL queries with TypeORM EntityManager (no repository pattern)
- One company per user enforced by `memberships.user_id` PRIMARY KEY
- Full document replacement (PUT) for bilty edits
- Soft-delete for parties using `archived` flag
- All timestamps as ISO strings in application layer, timestamptz in DB

## Review Focus

1. **Expired OAuth state reuse** — state tokens older than 10 minutes must be rejected even if not yet deleted; tests pin this
2. **Refresh token replay across browser tabs** — using an old token after rotation must revoke the entire family; Task 3 tests this
3. **Invite to different company for existing user** — must return 409 Conflict, not create duplicate membership; Task 4 tests this
4. **Party archive hiding but still referenceable** — archived parties excluded from list but valid for existing bilty references; Task 6 tests this
5. **Last admin revocation** — cannot deactivate the only admin; Task 5 tests this

---

## Task 1: Database Migration

**Files:**

- Create: `apps/api/src/database/migrations/1790000000001-AuthTables.ts`
- Modify: `apps/api/src/database/data-source.ts:3-12`

**Interfaces:**

- Consumes: Existing `companies`, `memberships`, `parties` tables
- Produces: `users`, `sessions`, `invites`, `oauth_states` tables; `archived` column on parties; FK from memberships to users

- [ ] **Step 1: Create migration file**

```typescript
// apps/api/src/database/migrations/1790000000001-AuthTables.ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthTables1790000000001 implements MigrationInterface {
  name = 'AuthTables1790000000001';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY,
        google_id text UNIQUE NOT NULL,
        email text UNIQUE NOT NULL,
        name text NOT NULL,
        avatar_url text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE sessions (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash text NOT NULL,
        token_family uuid NOT NULL,
        device_info text,
        expires_at timestamptz NOT NULL,
        is_revoked boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        rotated_at timestamptz
      );
      CREATE INDEX sessions_user_idx ON sessions(user_id);
      CREATE INDEX sessions_family_idx ON sessions(token_family);

      CREATE TABLE invites (
        id uuid PRIMARY KEY,
        company_id uuid NOT NULL REFERENCES companies(id),
        email text NOT NULL,
        role text NOT NULL CHECK (role IN ('admin','employee')),
        token_hash text NOT NULL,
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
        expires_at timestamptz NOT NULL,
        invited_by_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        accepted_at timestamptz
      );
      CREATE INDEX invites_company_idx ON invites(company_id);
      CREATE INDEX invites_email_idx ON invites(email, status);

      CREATE TABLE oauth_states (
        state text PRIMARY KEY,
        invite_token_hash text,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      );

      ALTER TABLE memberships ADD CONSTRAINT memberships_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id);

      ALTER TABLE parties ADD COLUMN archived boolean NOT NULL DEFAULT false;
      CREATE INDEX parties_company_active_idx ON parties(company_id, kind) WHERE NOT archived;
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP INDEX IF EXISTS parties_company_active_idx;
      ALTER TABLE parties DROP COLUMN IF EXISTS archived;
      ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_user_fk;
      DROP TABLE IF EXISTS oauth_states;
      DROP TABLE IF EXISTS invites;
      DROP TABLE IF EXISTS sessions;
      DROP TABLE IF EXISTS users;
    `);
  }
}
```

- [ ] **Step 2: Register migration in data-source**

```typescript
// apps/api/src/database/data-source.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { BiltyFoundation1790000000000 } from './migrations/1790000000000-BiltyFoundation';
import { AuthTables1790000000001 } from './migrations/1790000000001-AuthTables';

export function makeDataSource(url: string): DataSource {
  return new DataSource({
    type: 'postgres',
    url,
    synchronize: false,
    migrationsRun: false,
    migrations: [BiltyFoundation1790000000000, AuthTables1790000000001],
    migrationsTransactionMode: 'all',
    extra: { max: 16, connectionTimeoutMillis: 5000 },
  });
}
```

- [ ] **Step 3: Run migration test**

Run: `pnpm --filter @bilty/api test:integration`
Expected: Migration revert/reapply test passes (existing test covers this pattern)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/database/migrations/1790000000001-AuthTables.ts apps/api/src/database/data-source.ts
git commit -m "feat: add auth tables migration"
```

---

## Task 2: Shared Types for Auth

**Files:**

- Modify: `packages/shared-types/src/index.ts`

**Interfaces:**

- Consumes: Existing `UserRole` type
- Produces: `User`, `Session`, `Invite`, `InviteStatus`, `AuthenticatedUser`, `Tokens` types

- [ ] **Step 1: Add auth types to shared-types**

```typescript
// Append to packages/shared-types/src/index.ts

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  tokenFamily: string;
  deviceInfo: string | null;
  expiresAt: string;
  isRevoked: boolean;
  createdAt: string;
  rotatedAt: string | null;
}

export interface Invite {
  id: string;
  companyId: string;
  email: string;
  role: UserRole;
  status: InviteStatus;
  expiresAt: string;
  invitedById: string;
  createdAt: string;
  acceptedAt: string | null;
}

export interface AuthenticatedUser {
  userId: string;
  companyId: string;
  role: UserRole;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface Membership {
  userId: string;
  companyId: string;
  role: UserRole;
  active: boolean;
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat: add auth types to shared-types"
```

---

## Task 3: Auth Service with Token Rotation

**Files:**

- Create: `apps/api/src/modules/auth/auth.service.ts`
- Create: `apps/api/src/modules/auth/token.ts`
- Create: `apps/api/test/auth.test.ts`

**Interfaces:**

- Consumes: `User`, `Session`, `Tokens`, `Membership` from shared-types
- Produces: `AuthService.createSession(userId): Tokens`, `AuthService.refresh(refreshToken): Tokens`, `AuthService.logout(refreshToken): void`, `AuthService.logoutAll(userId): void`

- [ ] **Step 1: Write token helper tests**

```typescript
// apps/api/test/auth.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { signRefreshToken, verifyRefreshToken, sha256 } from '../src/modules/auth/token';

describe('token helpers', () => {
  test('signRefreshToken produces verifiable token', () => {
    const token = signRefreshToken('session-1', 'family-1', 'test-secret');
    const decoded = verifyRefreshToken(token, 'test-secret');
    assert.equal(decoded.sessionId, 'session-1');
    assert.equal(decoded.familyId, 'family-1');
    assert.ok(decoded.iat > 0);
  });

  test('verifyRefreshToken rejects tampered token', () => {
    const token = signRefreshToken('session-1', 'family-1', 'test-secret');
    const tampered = token.slice(0, -5) + 'xxxxx';
    assert.throws(() => verifyRefreshToken(tampered, 'test-secret'), /invalid/i);
  });

  test('verifyRefreshToken rejects wrong secret', () => {
    const token = signRefreshToken('session-1', 'family-1', 'test-secret');
    assert.throws(() => verifyRefreshToken(token, 'wrong-secret'), /invalid/i);
  });

  test('sha256 produces consistent hash', () => {
    const hash1 = sha256('test-input');
    const hash2 = sha256('test-input');
    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64); // hex
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bilty/api test`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement token helpers**

```typescript
// apps/api/src/modules/auth/token.ts
import { createHmac } from 'node:crypto';

interface RefreshPayload {
  sessionId: string;
  familyId: string;
  iat: number;
}

export function sha256(input: string): string {
  return createHmac('sha256', 'hash-salt').update(input).digest('hex');
}

export function signRefreshToken(sessionId: string, familyId: string, secret: string): string {
  const payload: RefreshPayload = { sessionId, familyId, iat: Math.floor(Date.now() / 1000) };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

export function verifyRefreshToken(token: string, secret: string): RefreshPayload {
  const [payloadB64, signature] = token.split('.');
  if (!payloadB64 || !signature) throw new Error('Invalid token format');
  const expected = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  if (signature !== expected) throw new Error('Invalid token signature');
  return JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
}
```

- [ ] **Step 4: Run token tests**

Run: `pnpm --filter @bilty/api test`
Expected: PASS

- [ ] **Step 5: Write auth service integration tests**

```typescript
// Append to apps/api/test/auth.test.ts
import { randomUUID } from 'node:crypto';
import { before, after, beforeEach } from 'node:test';
import { makeDataSource } from '../src/database/data-source';
import { AuthService } from '../src/modules/auth/auth.service';

const url = process.env.BILTY_TEST_DATABASE_URL;
if (url && process.env.BILTY_TEST_ALLOW_RESET === 'yes') {
  const db = makeDataSource(url);
  let authService: AuthService;
  const testUserId = randomUUID();

  before(async () => {
    await db.initialize();
    await db.query('DROP SCHEMA public CASCADE');
    await db.query('CREATE SCHEMA public');
    await db.runMigrations();
    authService = new AuthService(db, 'jwt-secret', 'refresh-secret', 900, 604800);
  });

  after(async () => {
    if (db.isInitialized) await db.destroy();
  });

  beforeEach(async () => {
    await db.query('TRUNCATE sessions, users CASCADE');
    await db.query(
      `INSERT INTO users (id, google_id, email, name) VALUES ($1, 'g-123', 'test@example.com', 'Test')`,
      [testUserId],
    );
  });

  describe('AuthService', () => {
    test('createSession returns valid tokens', async () => {
      const tokens = await authService.createSession(testUserId);
      assert.ok(tokens.accessToken);
      assert.ok(tokens.refreshToken);
    });

    test('refresh rotates token and invalidates old one', async () => {
      const tokens1 = await authService.createSession(testUserId);
      const tokens2 = await authService.refresh(tokens1.refreshToken);
      assert.notEqual(tokens1.refreshToken, tokens2.refreshToken);
      await assert.rejects(() => authService.refresh(tokens1.refreshToken), /reuse detected/i);
    });

    test('replay detection revokes entire token family', async () => {
      const tokens1 = await authService.createSession(testUserId);
      const tokens2 = await authService.refresh(tokens1.refreshToken);
      // Simulate attacker reusing old token
      await assert.rejects(() => authService.refresh(tokens1.refreshToken), /reuse detected/i);
      // Even the new token should be revoked
      await assert.rejects(() => authService.refresh(tokens2.refreshToken), /revoked/i);
    });

    test('logout revokes current session', async () => {
      const tokens = await authService.createSession(testUserId);
      await authService.logout(tokens.refreshToken);
      await assert.rejects(() => authService.refresh(tokens.refreshToken), /revoked/i);
    });

    test('logoutAll revokes all user sessions', async () => {
      const tokens1 = await authService.createSession(testUserId);
      const tokens2 = await authService.createSession(testUserId);
      await authService.logoutAll(testUserId);
      await assert.rejects(() => authService.refresh(tokens1.refreshToken), /revoked/i);
      await assert.rejects(() => authService.refresh(tokens2.refreshToken), /revoked/i);
    });
  });
}
```

- [ ] **Step 6: Implement AuthService**

```typescript
// apps/api/src/modules/auth/auth.service.ts
import { randomUUID } from 'node:crypto';
import { sign } from 'jsonwebtoken';
import type { DataSource, EntityManager } from 'typeorm';
import type { Tokens, AuthenticatedUser } from '@bilty/shared-types';
import { signRefreshToken, verifyRefreshToken, sha256 } from './token';

export class AuthService {
  constructor(
    private readonly db: DataSource,
    private readonly jwtSecret: string,
    private readonly refreshSecret: string,
    private readonly jwtExpiresIn: number,
    private readonly refreshExpiresIn: number,
  ) {}

  async createSession(userId: string, deviceInfo?: string): Promise<Tokens> {
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const refreshToken = signRefreshToken(sessionId, familyId, this.refreshSecret);
    const tokenHash = sha256(refreshToken);
    const expiresAt = new Date(Date.now() + this.refreshExpiresIn * 1000);

    await this.db.query(
      `INSERT INTO sessions (id, user_id, token_hash, token_family, device_info, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sessionId, userId, tokenHash, familyId, deviceInfo ?? null, expiresAt],
    );

    const accessToken = await this.signAccessToken(userId);
    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<Tokens> {
    const { sessionId, familyId } = verifyRefreshToken(refreshToken, this.refreshSecret);

    return this.db.transaction(async (tx) => {
      const [session] = await tx.query('SELECT * FROM sessions WHERE id = $1 FOR UPDATE', [
        sessionId,
      ]);

      if (!session) throw new Error('Session not found');
      if (session.is_revoked) throw new Error('Session revoked');
      if (new Date(session.expires_at) < new Date()) throw new Error('Session expired');

      const tokenHash = sha256(refreshToken);
      if (session.token_hash !== tokenHash) {
        // Replay detected - revoke entire family
        await tx.query('UPDATE sessions SET is_revoked = true WHERE token_family = $1', [familyId]);
        throw new Error('Token reuse detected; all sessions revoked');
      }

      const newRefreshToken = signRefreshToken(sessionId, familyId, this.refreshSecret);
      const newTokenHash = sha256(newRefreshToken);

      await tx.query('UPDATE sessions SET token_hash = $1, rotated_at = now() WHERE id = $2', [
        newTokenHash,
        sessionId,
      ]);

      const accessToken = await this.signAccessToken(session.user_id);
      return { accessToken, refreshToken: newRefreshToken };
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const { sessionId } = verifyRefreshToken(refreshToken, this.refreshSecret);
    await this.db.query('UPDATE sessions SET is_revoked = true WHERE id = $1', [sessionId]);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.db.query('UPDATE sessions SET is_revoked = true WHERE user_id = $1', [userId]);
  }

  private async signAccessToken(userId: string): Promise<string> {
    const [membership] = await this.db.query(
      'SELECT company_id, role FROM memberships WHERE user_id = $1 AND active = true',
      [userId],
    );

    const payload: AuthenticatedUser | { sub: string } = membership
      ? { userId, companyId: membership.company_id, role: membership.role }
      : { sub: userId };

    return sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
  }
}
```

- [ ] **Step 7: Run integration tests**

Run: `pnpm --filter @bilty/api test:integration`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/auth/ apps/api/test/auth.test.ts
git commit -m "feat: add auth service with token rotation"
```

---

## Task 4: Invite Service

**Files:**

- Create: `apps/api/src/modules/auth/invite.service.ts`
- Modify: `apps/api/test/auth.test.ts`

**Interfaces:**

- Consumes: `Invite`, `UserRole`, `Actor` from shared-types
- Produces: `InviteService.create(actor, email, role): { invite, token }`, `InviteService.accept(tokenHash, user): void`, `InviteService.revoke(actor, inviteId): void`, `InviteService.list(actor): Invite[]`

- [ ] **Step 1: Write invite service tests**

```typescript
// Append to apps/api/test/auth.test.ts
import { InviteService } from '../src/modules/auth/invite.service';

// Inside the if block, after AuthService tests
describe('InviteService', () => {
  let inviteService: InviteService;
  const companyId = randomUUID();
  const adminUserId = randomUUID();
  const actor = { userId: adminUserId, companyId };

  beforeEach(async () => {
    await db.query('TRUNCATE invites, memberships, companies, sessions, users CASCADE');
    await db.query(
      `INSERT INTO users (id, google_id, email, name) VALUES ($1, 'g-admin', 'admin@example.com', 'Admin')`,
      [adminUserId],
    );
    await db.query(`INSERT INTO companies (id, profile, number_prefix) VALUES ($1, '{}', 'TST/')`, [
      companyId,
    ]);
    await db.query(
      `INSERT INTO memberships (user_id, company_id, role, active) VALUES ($1, $2, 'admin', true)`,
      [adminUserId, companyId],
    );
    inviteService = new InviteService(db);
  });

  test('create generates invite with hashed token', async () => {
    const { invite, token } = await inviteService.create(actor, 'new@example.com', 'employee');
    assert.equal(invite.email, 'new@example.com');
    assert.equal(invite.role, 'employee');
    assert.equal(invite.status, 'pending');
    assert.ok(token.length > 20);
  });

  test('accept creates membership for new user', async () => {
    const { invite, token } = await inviteService.create(actor, 'new@example.com', 'employee');
    const newUserId = randomUUID();
    await db.query(
      `INSERT INTO users (id, google_id, email, name) VALUES ($1, 'g-new', 'new@example.com', 'New')`,
      [newUserId],
    );
    await inviteService.accept(sha256(token), { id: newUserId, email: 'new@example.com' });
    const [membership] = await db.query('SELECT * FROM memberships WHERE user_id = $1', [
      newUserId,
    ]);
    assert.equal(membership.company_id, companyId);
    assert.equal(membership.role, 'employee');
  });

  test('accept rejects invite to different company for existing member', async () => {
    const otherCompanyId = randomUUID();
    await db.query(`INSERT INTO companies (id, profile, number_prefix) VALUES ($1, '{}', 'OTH/')`, [
      otherCompanyId,
    ]);
    const existingUserId = randomUUID();
    await db.query(
      `INSERT INTO users (id, google_id, email, name) VALUES ($1, 'g-existing', 'existing@example.com', 'Existing')`,
      [existingUserId],
    );
    await db.query(
      `INSERT INTO memberships (user_id, company_id, role, active) VALUES ($1, $2, 'employee', true)`,
      [existingUserId, otherCompanyId],
    );

    const { token } = await inviteService.create(actor, 'existing@example.com', 'employee');
    await assert.rejects(
      () =>
        inviteService.accept(sha256(token), { id: existingUserId, email: 'existing@example.com' }),
      /already belong/i,
    );
  });

  test('accept reactivates revoked same-company membership', async () => {
    const revokedUserId = randomUUID();
    await db.query(
      `INSERT INTO users (id, google_id, email, name) VALUES ($1, 'g-revoked', 'revoked@example.com', 'Revoked')`,
      [revokedUserId],
    );
    await db.query(
      `INSERT INTO memberships (user_id, company_id, role, active) VALUES ($1, $2, 'employee', false)`,
      [revokedUserId, companyId],
    );

    const { token } = await inviteService.create(actor, 'revoked@example.com', 'admin');
    await inviteService.accept(sha256(token), { id: revokedUserId, email: 'revoked@example.com' });

    const [membership] = await db.query('SELECT * FROM memberships WHERE user_id = $1', [
      revokedUserId,
    ]);
    assert.equal(membership.active, true);
    assert.equal(membership.role, 'admin'); // Upgraded role
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bilty/api test:integration`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement InviteService**

```typescript
// apps/api/src/modules/auth/invite.service.ts
import { randomUUID, randomBytes } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { Actor, Invite, UserRole } from '@bilty/shared-types';
import { sha256 } from './token';

interface InviteResult {
  invite: Invite;
  token: string;
}

export class InviteService {
  constructor(private readonly db: DataSource) {}

  async create(actor: Actor, email: string, role: UserRole): Promise<InviteResult> {
    const id = randomUUID();
    const token = randomBytes(32).toString('base64url');
    const tokenHash = sha256(token);
    const normalizedEmail = email.toLowerCase().trim();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [row] = await this.db.query(
      `INSERT INTO invites (id, company_id, email, role, token_hash, expires_at, invited_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, company_id, email, role, status, expires_at, invited_by_id, created_at, accepted_at`,
      [id, actor.companyId, normalizedEmail, role, tokenHash, expiresAt, actor.userId],
    );

    return {
      invite: this.hydrate(row),
      token,
    };
  }

  async accept(tokenHash: string, user: { id: string; email: string }): Promise<void> {
    return this.db.transaction(async (tx) => {
      const [invite] = await tx.query(
        `SELECT * FROM invites WHERE token_hash = $1 AND status = 'pending' FOR UPDATE`,
        [tokenHash],
      );

      if (!invite) throw new Error('Invalid or expired invite');
      if (new Date(invite.expires_at) < new Date()) {
        await tx.query(`UPDATE invites SET status = 'expired' WHERE id = $1`, [invite.id]);
        throw new Error('Invite has expired');
      }
      if (invite.email !== user.email.toLowerCase()) {
        throw new Error('This invite was sent to a different email address');
      }

      // Check existing membership
      const [existing] = await tx.query(
        'SELECT company_id, active FROM memberships WHERE user_id = $1',
        [user.id],
      );

      if (existing) {
        if (existing.company_id === invite.company_id) {
          // Same company - reactivate if needed
          if (!existing.active) {
            await tx.query('UPDATE memberships SET active = true, role = $1 WHERE user_id = $2', [
              invite.role,
              user.id,
            ]);
          }
        } else {
          throw new Error(
            'You already belong to another company. Multi-company membership is not supported in V1.',
          );
        }
      } else {
        await tx.query(
          'INSERT INTO memberships (user_id, company_id, role, active) VALUES ($1, $2, $3, true)',
          [user.id, invite.company_id, invite.role],
        );
      }

      await tx.query(`UPDATE invites SET status = 'accepted', accepted_at = now() WHERE id = $1`, [
        invite.id,
      ]);
    });
  }

  async revoke(actor: Actor, inviteId: string): Promise<void> {
    const [, affected] = await this.db.query(
      `UPDATE invites SET status = 'revoked'
       WHERE id = $1 AND company_id = $2 AND status = 'pending'
       RETURNING id`,
      [inviteId, actor.companyId],
    );
    if (affected !== 1) throw new Error('Invite not found or already used');
  }

  async list(actor: Actor): Promise<Invite[]> {
    const rows = await this.db.query(
      `SELECT * FROM invites WHERE company_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [actor.companyId],
    );
    return rows.map((r: any) => this.hydrate(r));
  }

  private hydrate(row: any): Invite {
    return {
      id: row.id,
      companyId: row.company_id,
      email: row.email,
      role: row.role,
      status: row.status,
      expiresAt: new Date(row.expires_at).toISOString(),
      invitedById: row.invited_by_id,
      createdAt: new Date(row.created_at).toISOString(),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : null,
    };
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @bilty/api test:integration`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/invite.service.ts apps/api/test/auth.test.ts
git commit -m "feat: add invite service with one-company enforcement"
```

---

## Task 5: Membership Service with Last Admin Protection

**Files:**

- Create: `apps/api/src/modules/auth/membership.service.ts`
- Modify: `apps/api/test/auth.test.ts`

**Interfaces:**

- Consumes: `Actor`, `Membership`, `UserRole` from shared-types
- Produces: `MembershipService.revoke(actor, targetUserId): void`, `MembershipService.updateRole(actor, targetUserId, role): void`, `MembershipService.list(actor): Membership[]`

- [ ] **Step 1: Write membership service tests**

```typescript
// Append to apps/api/test/auth.test.ts
import { MembershipService } from '../src/modules/auth/membership.service';

describe('MembershipService', () => {
  let membershipService: MembershipService;
  const companyId = randomUUID();
  const adminUserId = randomUUID();
  const employeeUserId = randomUUID();
  const actor = { userId: adminUserId, companyId };

  beforeEach(async () => {
    await db.query('TRUNCATE memberships, companies, users CASCADE');
    await db.query(
      `INSERT INTO users (id, google_id, email, name) VALUES
       ($1, 'g-admin', 'admin@example.com', 'Admin'),
       ($2, 'g-emp', 'employee@example.com', 'Employee')`,
      [adminUserId, employeeUserId],
    );
    await db.query(`INSERT INTO companies (id, profile, number_prefix) VALUES ($1, '{}', 'TST/')`, [
      companyId,
    ]);
    await db.query(
      `INSERT INTO memberships (user_id, company_id, role, active) VALUES
       ($1, $2, 'admin', true),
       ($3, $2, 'employee', true)`,
      [adminUserId, companyId, employeeUserId],
    );
    membershipService = new MembershipService(db);
  });

  test('revoke deactivates employee membership', async () => {
    await membershipService.revoke(actor, employeeUserId);
    const [membership] = await db.query('SELECT active FROM memberships WHERE user_id = $1', [
      employeeUserId,
    ]);
    assert.equal(membership.active, false);
  });

  test('revoke prevents deactivating last admin', async () => {
    await assert.rejects(() => membershipService.revoke(actor, adminUserId), /last admin/i);
  });

  test('revoke allows deactivating admin when another exists', async () => {
    const secondAdminId = randomUUID();
    await db.query(
      `INSERT INTO users (id, google_id, email, name) VALUES ($1, 'g-admin2', 'admin2@example.com', 'Admin2')`,
      [secondAdminId],
    );
    await db.query(
      `INSERT INTO memberships (user_id, company_id, role, active) VALUES ($1, $2, 'admin', true)`,
      [secondAdminId, companyId],
    );
    await membershipService.revoke(actor, adminUserId);
    const [membership] = await db.query('SELECT active FROM memberships WHERE user_id = $1', [
      adminUserId,
    ]);
    assert.equal(membership.active, false);
  });

  test('updateRole prevents demoting last admin', async () => {
    await assert.rejects(
      () => membershipService.updateRole(actor, adminUserId, 'employee'),
      /last admin/i,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bilty/api test:integration`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement MembershipService**

```typescript
// apps/api/src/modules/auth/membership.service.ts
import type { DataSource } from 'typeorm';
import type { Actor, Membership, UserRole } from '@bilty/shared-types';

export class MembershipService {
  constructor(private readonly db: DataSource) {}

  async revoke(actor: Actor, targetUserId: string): Promise<void> {
    return this.db.transaction(async (tx) => {
      const [target] = await tx.query(
        'SELECT role, active FROM memberships WHERE user_id = $1 AND company_id = $2 FOR UPDATE',
        [targetUserId, actor.companyId],
      );

      if (!target || !target.active) {
        throw new Error('Membership not found');
      }

      if (target.role === 'admin') {
        const [{ count }] = await tx.query(
          `SELECT COUNT(*) as count FROM memberships
           WHERE company_id = $1 AND role = 'admin' AND active = true`,
          [actor.companyId],
        );
        if (parseInt(count) <= 1) {
          throw new Error('Cannot revoke the last admin. Transfer admin role first.');
        }
      }

      await tx.query('UPDATE memberships SET active = false WHERE user_id = $1', [targetUserId]);
    });
  }

  async updateRole(actor: Actor, targetUserId: string, role: UserRole): Promise<void> {
    return this.db.transaction(async (tx) => {
      const [target] = await tx.query(
        'SELECT role, active FROM memberships WHERE user_id = $1 AND company_id = $2 FOR UPDATE',
        [targetUserId, actor.companyId],
      );

      if (!target || !target.active) {
        throw new Error('Membership not found');
      }

      // If demoting from admin, check not last admin
      if (target.role === 'admin' && role !== 'admin') {
        const [{ count }] = await tx.query(
          `SELECT COUNT(*) as count FROM memberships
           WHERE company_id = $1 AND role = 'admin' AND active = true`,
          [actor.companyId],
        );
        if (parseInt(count) <= 1) {
          throw new Error('Cannot demote the last admin. Promote another user first.');
        }
      }

      await tx.query('UPDATE memberships SET role = $1 WHERE user_id = $2', [role, targetUserId]);
    });
  }

  async list(actor: Actor): Promise<Membership[]> {
    const rows = await this.db.query(
      `SELECT m.user_id, m.company_id, m.role, m.active, u.email, u.name
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.company_id = $1
       ORDER BY m.active DESC, u.name`,
      [actor.companyId],
    );
    return rows.map((r: any) => ({
      userId: r.user_id,
      companyId: r.company_id,
      role: r.role,
      active: r.active,
    }));
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @bilty/api test:integration`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/membership.service.ts apps/api/test/auth.test.ts
git commit -m "feat: add membership service with last admin protection"
```

---

## Task 6: Party Service with Soft Delete

**Files:**

- Create: `apps/api/src/modules/party/party.service.ts`
- Create: `apps/api/test/party.test.ts`

**Interfaces:**

- Consumes: `Actor`, `PartySnapshot` from shared-types
- Produces: `PartyService.create(actor, kind, snapshot): Party`, `PartyService.update(actor, id, snapshot): Party`, `PartyService.archive(actor, id): void`, `PartyService.list(actor): Party[]`, `PartyService.get(actor, id): Party`

- [ ] **Step 1: Write party service tests**

```typescript
// apps/api/test/party.test.ts
import 'reflect-metadata';
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { makeDataSource } from '../src/database/data-source';
import { PartyService } from '../src/modules/party/party.service';

const url = process.env.BILTY_TEST_DATABASE_URL;
if (!url || process.env.BILTY_TEST_ALLOW_RESET !== 'yes')
  throw new Error('Provide BILTY_TEST_DATABASE_URL and BILTY_TEST_ALLOW_RESET=yes');

const db = makeDataSource(url);
let partyService: PartyService;
const companyId = randomUUID();
const userId = randomUUID();
const actor = { userId, companyId };

before(async () => {
  await db.initialize();
  await db.query('DROP SCHEMA public CASCADE');
  await db.query('CREATE SCHEMA public');
  await db.runMigrations();
  partyService = new PartyService(db);
});

after(async () => {
  if (db.isInitialized) await db.destroy();
});

beforeEach(async () => {
  await db.query('TRUNCATE parties, memberships, companies, users CASCADE');
  await db.query(
    `INSERT INTO users (id, google_id, email, name) VALUES ($1, 'g-1', 'u@e.com', 'U')`,
    [userId],
  );
  await db.query(`INSERT INTO companies (id, profile, number_prefix) VALUES ($1, '{}', 'P/')`, [
    companyId,
  ]);
  await db.query(
    `INSERT INTO memberships (user_id, company_id, role, active) VALUES ($1, $2, 'admin', true)`,
    [userId, companyId],
  );
});

describe('PartyService', () => {
  test('create and list parties', async () => {
    await partyService.create(actor, 'consignor', { name: 'Sender', address: 'Delhi' });
    await partyService.create(actor, 'consignee', { name: 'Receiver', address: 'Mumbai' });
    const list = await partyService.list(actor);
    assert.equal(list.length, 2);
  });

  test('archived party excluded from list', async () => {
    const party = await partyService.create(actor, 'consignor', {
      name: 'Sender',
      address: 'Delhi',
    });
    await partyService.archive(actor, party.id);
    const list = await partyService.list(actor);
    assert.equal(list.length, 0);
  });

  test('archived party still retrievable by id', async () => {
    const party = await partyService.create(actor, 'consignor', {
      name: 'Sender',
      address: 'Delhi',
    });
    await partyService.archive(actor, party.id);
    const retrieved = await partyService.get(actor, party.id);
    assert.equal(retrieved.archived, true);
  });

  test('update party snapshot', async () => {
    const party = await partyService.create(actor, 'consignor', { name: 'Old', address: 'Old' });
    const updated = await partyService.update(actor, party.id, { name: 'New', address: 'New' });
    assert.equal(updated.snapshot.name, 'New');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx apps/api/test/party.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement PartyService**

```typescript
// apps/api/src/modules/party/party.service.ts
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { Actor, PartySnapshot } from '@bilty/shared-types';

export interface Party {
  id: string;
  companyId: string;
  kind: 'consignor' | 'consignee';
  snapshot: PartySnapshot;
  archived: boolean;
}

export class PartyService {
  constructor(private readonly db: DataSource) {}

  private async authorized<T>(actor: Actor, work: () => Promise<T>): Promise<T> {
    const [membership] = await this.db.query(
      'SELECT user_id FROM memberships WHERE user_id = $1 AND company_id = $2 AND active = true',
      [actor.userId, actor.companyId],
    );
    if (!membership) throw new Error('Active company membership required');
    return work();
  }

  async create(
    actor: Actor,
    kind: 'consignor' | 'consignee',
    snapshot: Partial<PartySnapshot>,
  ): Promise<Party> {
    return this.authorized(actor, async () => {
      const id = randomUUID();
      const fullSnapshot: PartySnapshot = {
        partyId: id,
        name: snapshot.name ?? '',
        address: snapshot.address ?? '',
        gstin: snapshot.gstin ?? '',
        phone: snapshot.phone ?? '',
      };

      await this.db.query(
        'INSERT INTO parties (id, company_id, kind, snapshot) VALUES ($1, $2, $3, $4)',
        [id, actor.companyId, kind, fullSnapshot],
      );

      return { id, companyId: actor.companyId, kind, snapshot: fullSnapshot, archived: false };
    });
  }

  async update(actor: Actor, id: string, snapshot: Partial<PartySnapshot>): Promise<Party> {
    return this.authorized(actor, async () => {
      const [existing] = await this.db.query(
        'SELECT * FROM parties WHERE id = $1 AND company_id = $2',
        [id, actor.companyId],
      );
      if (!existing) throw new Error('Party not found');

      const fullSnapshot: PartySnapshot = {
        ...existing.snapshot,
        ...snapshot,
        partyId: id,
      };

      await this.db.query('UPDATE parties SET snapshot = $1 WHERE id = $2', [fullSnapshot, id]);

      return {
        id,
        companyId: actor.companyId,
        kind: existing.kind,
        snapshot: fullSnapshot,
        archived: existing.archived,
      };
    });
  }

  async archive(actor: Actor, id: string): Promise<void> {
    return this.authorized(actor, async () => {
      const [, affected] = await this.db.query(
        'UPDATE parties SET archived = true WHERE id = $1 AND company_id = $2 AND NOT archived RETURNING id',
        [id, actor.companyId],
      );
      if (affected !== 1) throw new Error('Party not found');
    });
  }

  async list(actor: Actor): Promise<Party[]> {
    return this.authorized(actor, async () => {
      const rows = await this.db.query(
        "SELECT * FROM parties WHERE company_id = $1 AND NOT archived ORDER BY (snapshot->>'name')",
        [actor.companyId],
      );
      return rows.map((r: any) => ({
        id: r.id,
        companyId: r.company_id,
        kind: r.kind,
        snapshot: r.snapshot,
        archived: r.archived,
      }));
    });
  }

  async get(actor: Actor, id: string): Promise<Party> {
    return this.authorized(actor, async () => {
      const [row] = await this.db.query('SELECT * FROM parties WHERE id = $1 AND company_id = $2', [
        id,
        actor.companyId,
      ]);
      if (!row) throw new Error('Party not found');
      return {
        id: row.id,
        companyId: row.company_id,
        kind: row.kind,
        snapshot: row.snapshot,
        archived: row.archived,
      };
    });
  }
}
```

- [ ] **Step 4: Run tests**

Run: `node --import tsx apps/api/test/party.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/party/ apps/api/test/party.test.ts
git commit -m "feat: add party service with soft delete"
```

---

## Task 7: OAuth Service and State Management

**Files:**

- Create: `apps/api/src/modules/auth/oauth.service.ts`
- Modify: `apps/api/test/auth.test.ts`

**Interfaces:**

- Consumes: `User` from shared-types
- Produces: `OAuthService.createState(inviteTokenHash?): string`, `OAuthService.validateState(state): { inviteTokenHash? }`, `OAuthService.findOrCreateUser(profile): User`, `OAuthService.handleCallback(code, state): Tokens | { redirectTo }`

- [ ] **Step 1: Write OAuth state tests**

```typescript
// Append to apps/api/test/auth.test.ts
import { OAuthService } from '../src/modules/auth/oauth.service';

describe('OAuthService', () => {
  let oauthService: OAuthService;

  beforeEach(async () => {
    await db.query('TRUNCATE oauth_states, users CASCADE');
    oauthService = new OAuthService(db);
  });

  test('createState stores state with expiry', async () => {
    const state = await oauthService.createState();
    assert.ok(state.length > 20);
    const [row] = await db.query('SELECT * FROM oauth_states WHERE state = $1', [state]);
    assert.ok(row);
    assert.ok(new Date(row.expires_at) > new Date());
  });

  test('validateState returns and deletes state', async () => {
    const state = await oauthService.createState();
    const result = await oauthService.validateState(state);
    assert.equal(result.inviteTokenHash, null);
    const [row] = await db.query('SELECT * FROM oauth_states WHERE state = $1', [state]);
    assert.equal(row, undefined);
  });

  test('validateState rejects expired state', async () => {
    const state = await oauthService.createState();
    await db.query(
      `UPDATE oauth_states SET expires_at = now() - interval '1 minute' WHERE state = $1`,
      [state],
    );
    await assert.rejects(() => oauthService.validateState(state), /expired/i);
  });

  test('validateState rejects missing state', async () => {
    await assert.rejects(() => oauthService.validateState('nonexistent'), /invalid/i);
  });

  test('findOrCreateUser creates new user', async () => {
    const user = await oauthService.findOrCreateUser({
      id: 'google-123',
      email: 'Test@Example.COM',
      name: 'Test User',
      picture: 'https://example.com/photo.jpg',
    });
    assert.equal(user.email, 'test@example.com'); // Normalized
    assert.equal(user.googleId, 'google-123');
  });

  test('findOrCreateUser returns existing user', async () => {
    const user1 = await oauthService.findOrCreateUser({
      id: 'google-123',
      email: 'test@example.com',
      name: 'Test User',
      picture: null,
    });
    const user2 = await oauthService.findOrCreateUser({
      id: 'google-123',
      email: 'test@example.com',
      name: 'Updated Name',
      picture: 'https://example.com/new.jpg',
    });
    assert.equal(user1.id, user2.id);
    assert.equal(user2.name, 'Updated Name');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bilty/api test:integration`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement OAuthService**

```typescript
// apps/api/src/modules/auth/oauth.service.ts
import { randomUUID, randomBytes } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { User } from '@bilty/shared-types';

interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  picture: string | null;
}

export class OAuthService {
  constructor(private readonly db: DataSource) {}

  async createState(inviteTokenHash?: string): Promise<string> {
    const state = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.db.query(
      'INSERT INTO oauth_states (state, invite_token_hash, expires_at) VALUES ($1, $2, $3)',
      [state, inviteTokenHash ?? null, expiresAt],
    );

    return state;
  }

  async validateState(state: string): Promise<{ inviteTokenHash: string | null }> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.query(
        'DELETE FROM oauth_states WHERE state = $1 RETURNING invite_token_hash, expires_at',
        [state],
      );

      if (!row) throw new Error('Invalid OAuth state');
      if (new Date(row.expires_at) < new Date()) throw new Error('OAuth state expired');

      return { inviteTokenHash: row.invite_token_hash };
    });
  }

  async findOrCreateUser(profile: GoogleProfile): Promise<User> {
    const normalizedEmail = profile.email.toLowerCase().trim();

    return this.db.transaction(async (tx) => {
      const [existing] = await tx.query('SELECT * FROM users WHERE google_id = $1 FOR UPDATE', [
        profile.id,
      ]);

      if (existing) {
        // Update name and avatar
        await tx.query(
          'UPDATE users SET name = $1, avatar_url = $2, updated_at = now() WHERE id = $3',
          [profile.name, profile.picture, existing.id],
        );
        return this.hydrate({ ...existing, name: profile.name, avatar_url: profile.picture });
      }

      const id = randomUUID();
      const [row] = await tx.query(
        `INSERT INTO users (id, google_id, email, name, avatar_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, profile.id, normalizedEmail, profile.name, profile.picture],
      );

      return this.hydrate(row);
    });
  }

  private hydrate(row: any): User {
    return {
      id: row.id,
      googleId: row.google_id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatar_url,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @bilty/api test:integration`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/oauth.service.ts apps/api/test/auth.test.ts
git commit -m "feat: add oauth service with state management"
```

---

## Task 8: NestJS Guards and Decorators

**Files:**

- Create: `apps/api/src/modules/auth/jwt.strategy.ts`
- Create: `apps/api/src/modules/auth/jwt.guard.ts`
- Create: `apps/api/src/modules/auth/decorators.ts`
- Create: `apps/api/src/modules/auth/auth.module.ts`

**Interfaces:**

- Consumes: `AuthenticatedUser` from shared-types
- Produces: `JwtAuthGuard`, `@CurrentUser()` decorator, `AuthModule`

- [ ] **Step 1: Create JWT strategy**

```typescript
// apps/api/src/modules/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '@bilty/shared-types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(jwtSecret: string) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  validate(payload: AuthenticatedUser): AuthenticatedUser {
    return payload;
  }
}
```

- [ ] **Step 2: Create JWT guard**

```typescript
// apps/api/src/modules/auth/jwt.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<T>(err: Error | null, user: T): T {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
```

- [ ] **Step 3: Create decorators**

```typescript
// apps/api/src/modules/auth/decorators.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '@bilty/shared-types';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

- [ ] **Step 4: Create auth module**

```typescript
// apps/api/src/modules/auth/auth.module.ts
import { Module, type DynamicModule } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import type { DataSource } from 'typeorm';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt.guard';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { InviteService } from './invite.service';
import { MembershipService } from './membership.service';

export interface AuthModuleOptions {
  db: DataSource;
  jwtSecret: string;
  refreshSecret: string;
  jwtExpiresIn: number;
  refreshExpiresIn: number;
}

@Module({})
export class AuthModule {
  static forRoot(options: AuthModuleOptions): DynamicModule {
    return {
      module: AuthModule,
      imports: [
        PassportModule,
        JwtModule.register({
          secret: options.jwtSecret,
          signOptions: { expiresIn: options.jwtExpiresIn },
        }),
      ],
      providers: [
        { provide: JwtStrategy, useFactory: () => new JwtStrategy(options.jwtSecret) },
        { provide: JwtAuthGuard, useClass: JwtAuthGuard },
        {
          provide: AuthService,
          useFactory: () =>
            new AuthService(
              options.db,
              options.jwtSecret,
              options.refreshSecret,
              options.jwtExpiresIn,
              options.refreshExpiresIn,
            ),
        },
        { provide: OAuthService, useFactory: () => new OAuthService(options.db) },
        { provide: InviteService, useFactory: () => new InviteService(options.db) },
        { provide: MembershipService, useFactory: () => new MembershipService(options.db) },
      ],
      exports: [JwtAuthGuard, AuthService, OAuthService, InviteService, MembershipService],
    };
  }
}
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/auth/
git commit -m "feat: add nestjs auth module with guards and decorators"
```

---

## Task 9: HTTP Controllers

**Files:**

- Create: `apps/api/src/modules/auth/auth.controller.ts`
- Create: `apps/api/src/modules/bilty/bilty.controller.ts`
- Create: `apps/api/src/modules/party/party.controller.ts`
- Create: `apps/api/src/modules/party/party.module.ts`

**Interfaces:**

- Consumes: All services from previous tasks
- Produces: REST endpoints per spec section 8

- [ ] **Step 1: Create auth controller**

```typescript
// apps/api/src/modules/auth/auth.controller.ts
import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  Req,
  UseGuards,
  UnauthorizedException,
  Body,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from './jwt.guard';
import { CurrentUser } from './decorators';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { InviteService } from './invite.service';
import type { AuthenticatedUser } from '@bilty/shared-types';
import { sha256 } from './token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
    private readonly inviteService: InviteService,
    private readonly googleClientId: string,
    private readonly googleCallbackUrl: string,
    private readonly frontendUrl: string,
  ) {}

  @Get('google')
  async initiateOAuth(
    @Query('invite') inviteToken: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const inviteTokenHash = inviteToken ? sha256(inviteToken) : undefined;
    const state = await this.oauthService.createState(inviteTokenHash);

    const params = new URLSearchParams({
      client_id: this.googleClientId,
      redirect_uri: this.googleCallbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response): Promise<void> {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) throw new UnauthorizedException('No refresh token');

    const tokens = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(res, tokens.refreshToken);
    res.json({ accessToken: tokens.accessToken });
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    res.clearCookie('refresh_token', { path: '/auth' });
    res.status(204).send();
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(@CurrentUser() user: AuthenticatedUser, @Res() res: Response): Promise<void> {
    await this.authService.logoutAll(user.userId);
    res.clearCookie('refresh_token', { path: '/auth' });
    res.status(204).send();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
```

- [ ] **Step 2: Create bilty controller**

```typescript
// apps/api/src/modules/bilty/bilty.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/decorators';
import { BiltyService } from './bilty.service';
import { BiltyError } from './errors';
import { printData } from './domain';
import type { AuthenticatedUser, BiltyRecord } from '@bilty/shared-types';

class UpdateBiltyDto {
  expectedVersion!: number;
  data!: unknown;
  reason?: string;
}

class IssueBiltyDto {
  expectedVersion!: number;
}

class CancelBiltyDto {
  expectedVersion!: number;
  reason!: string;
}

@Controller('biltys')
@UseGuards(JwtAuthGuard)
export class BiltyController {
  constructor(private readonly biltyService: BiltyService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { data: unknown },
  ): Promise<BiltyRecord> {
    return this.wrap(() =>
      this.biltyService.createDraft({ userId: user.userId, companyId: user.companyId }, body.data),
    );
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<BiltyRecord[]> {
    return this.wrap(() =>
      this.biltyService.list({ userId: user.userId, companyId: user.companyId }),
    );
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<BiltyRecord> {
    return this.wrap(() =>
      this.biltyService.get({ userId: user.userId, companyId: user.companyId }, id),
    );
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateBiltyDto,
  ): Promise<BiltyRecord> {
    return this.wrap(() =>
      this.biltyService.edit(
        { userId: user.userId, companyId: user.companyId },
        id,
        body.expectedVersion,
        body.data,
        body.reason ?? '',
      ),
    );
  }

  @Post(':id/issue')
  async issue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: IssueBiltyDto,
  ): Promise<BiltyRecord> {
    return this.wrap(() =>
      this.biltyService.issue(
        { userId: user.userId, companyId: user.companyId },
        id,
        body.expectedVersion,
      ),
    );
  }

  @Post(':id/cancel')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CancelBiltyDto,
  ): Promise<BiltyRecord> {
    return this.wrap(() =>
      this.biltyService.cancel(
        { userId: user.userId, companyId: user.companyId },
        id,
        body.expectedVersion,
        body.reason,
      ),
    );
  }

  @Get(':id/print')
  async print(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const bilty = await this.wrap(() =>
      this.biltyService.get({ userId: user.userId, companyId: user.companyId }, id),
    );
    return printData(bilty);
  }

  @Get(':id/history')
  async history(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wrap(() =>
      this.biltyService.history({ userId: user.userId, companyId: user.companyId }, id),
    );
  }

  private async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof BiltyError) {
        const status = {
          VALIDATION: HttpStatus.BAD_REQUEST,
          NOT_FOUND: HttpStatus.NOT_FOUND,
          FORBIDDEN: HttpStatus.FORBIDDEN,
          CONFLICT: HttpStatus.CONFLICT,
        }[e.code];
        throw new HttpException(e.message, status);
      }
      throw e;
    }
  }
}
```

- [ ] **Step 3: Create party controller and module**

```typescript
// apps/api/src/modules/party/party.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/decorators';
import { PartyService, type Party } from './party.service';
import type { AuthenticatedUser, PartySnapshot } from '@bilty/shared-types';

@Controller('parties')
@UseGuards(JwtAuthGuard)
export class PartyController {
  constructor(private readonly partyService: PartyService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { kind: 'consignor' | 'consignee'; snapshot: Partial<PartySnapshot> },
  ): Promise<Party> {
    return this.partyService.create(
      { userId: user.userId, companyId: user.companyId },
      body.kind,
      body.snapshot,
    );
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<Party[]> {
    return this.partyService.list({ userId: user.userId, companyId: user.companyId });
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Party> {
    try {
      return await this.partyService.get({ userId: user.userId, companyId: user.companyId }, id);
    } catch {
      throw new NotFoundException('Party not found');
    }
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { snapshot: Partial<PartySnapshot> },
  ): Promise<Party> {
    try {
      return await this.partyService.update(
        { userId: user.userId, companyId: user.companyId },
        id,
        body.snapshot,
      );
    } catch {
      throw new NotFoundException('Party not found');
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    try {
      await this.partyService.archive({ userId: user.userId, companyId: user.companyId }, id);
    } catch {
      throw new NotFoundException('Party not found');
    }
  }
}
```

```typescript
// apps/api/src/modules/party/party.module.ts
import { Module, type DynamicModule } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { PartyService } from './party.service';
import { PartyController } from './party.controller';

@Module({})
export class PartyModule {
  static forRoot(db: DataSource): DynamicModule {
    return {
      module: PartyModule,
      controllers: [PartyController],
      providers: [{ provide: PartyService, useFactory: () => new PartyService(db) }],
      exports: [PartyService],
    };
  }
}
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/
git commit -m "feat: add http controllers for auth, biltys and parties"
```

---

## Task 10: Add Dependencies and Update Exports

**Files:**

- Modify: `apps/api/package.json`
- Modify: `apps/api/src/index.ts`

**Interfaces:**

- Consumes: All modules
- Produces: Updated package exports

- [ ] **Step 1: Add required dependencies**

```json
{
  "dependencies": {
    "@bilty/shared-types": "workspace:*",
    "@nestjs/common": "^11.1.6",
    "@nestjs/jwt": "^11.0.0",
    "@nestjs/passport": "^11.0.0",
    "@nestjs/platform-express": "^11.1.6",
    "cookie-parser": "^1.4.7",
    "jsonwebtoken": "^9.0.2",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "pg": "^8.23.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2",
    "typeorm": "~0.3.28",
    "zod": "^4.1.0"
  },
  "devDependencies": {
    "@types/cookie-parser": "^1.4.8",
    "@types/jsonwebtoken": "^9.0.9",
    "@types/passport-jwt": "^4.0.1",
    "tsx": "^4.20.0"
  }
}
```

- [ ] **Step 2: Update exports**

```typescript
// apps/api/src/index.ts
import 'reflect-metadata';
export { BiltyModule } from './modules/bilty/bilty.module';
export { BiltyService } from './modules/bilty/bilty.service';
export { BiltyController } from './modules/bilty/bilty.controller';
export { BiltyError } from './modules/bilty/errors';
export { printData } from './modules/bilty/domain';
export { makeDataSource } from './database/data-source';
export { AuthModule } from './modules/auth/auth.module';
export { AuthService } from './modules/auth/auth.service';
export { OAuthService } from './modules/auth/oauth.service';
export { InviteService } from './modules/auth/invite.service';
export { MembershipService } from './modules/auth/membership.service';
export { JwtAuthGuard } from './modules/auth/jwt.guard';
export { CurrentUser } from './modules/auth/decorators';
export { PartyModule } from './modules/party/party.module';
export { PartyService } from './modules/party/party.service';
export { PartyController } from './modules/party/party.controller';
```

- [ ] **Step 3: Install dependencies and verify**

Run: `pnpm install && pnpm typecheck && pnpm build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json apps/api/src/index.ts pnpm-lock.yaml
git commit -m "feat: add auth dependencies and update exports"
```

---

## Task 11: Full Integration Test Suite

**Files:**

- Create: `apps/api/test/integration.test.ts`

**Interfaces:**

- Consumes: All services
- Produces: End-to-end integration tests

- [ ] **Step 1: Write comprehensive integration tests**

```typescript
// apps/api/test/integration.test.ts
import 'reflect-metadata';
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { makeDataSource } from '../src/database/data-source';
import { AuthService } from '../src/modules/auth/auth.service';
import { OAuthService } from '../src/modules/auth/oauth.service';
import { InviteService } from '../src/modules/auth/invite.service';
import { MembershipService } from '../src/modules/auth/membership.service';
import { PartyService } from '../src/modules/party/party.service';
import { BiltyService } from '../src/modules/bilty/bilty.service';
import { sha256 } from '../src/modules/auth/token';
import { completeData } from './fixtures';

const url = process.env.BILTY_TEST_DATABASE_URL;
if (!url || process.env.BILTY_TEST_ALLOW_RESET !== 'yes')
  throw new Error('Provide BILTY_TEST_DATABASE_URL and BILTY_TEST_ALLOW_RESET=yes');

const db = makeDataSource(url);

before(async () => {
  await db.initialize();
  await db.query('DROP SCHEMA public CASCADE');
  await db.query('CREATE SCHEMA public');
  await db.runMigrations();
});

after(async () => {
  if (db.isInitialized) await db.destroy();
});

describe('Self-serve onboarding flow', () => {
  const oauthService = new OAuthService(db);
  const authService = new AuthService(db, 'jwt', 'refresh', 900, 604800);

  beforeEach(async () => {
    await db.query('TRUNCATE oauth_states, sessions, memberships, companies, users CASCADE');
  });

  test('OAuth → setup → company + admin membership', async () => {
    // 1. User creates OAuth state and authenticates
    const state = await oauthService.createState();
    await oauthService.validateState(state);

    // 2. User is created
    const user = await oauthService.findOrCreateUser({
      id: 'google-new',
      email: 'newuser@example.com',
      name: 'New User',
      picture: null,
    });

    // 3. User creates company
    const companyId = randomUUID();
    await db.query(
      `INSERT INTO companies (id, profile, number_prefix) VALUES ($1, '{"name":"New Co"}', 'NEW/')`,
      [companyId],
    );
    await db.query(
      `INSERT INTO memberships (user_id, company_id, role, active) VALUES ($1, $2, 'admin', true)`,
      [user.id, companyId],
    );

    // 4. Session created with membership info
    const tokens = await authService.createSession(user.id);
    assert.ok(tokens.accessToken);
  });
});

describe('Invite acceptance flow', () => {
  const oauthService = new OAuthService(db);
  const inviteService = new InviteService(db);
  const authService = new AuthService(db, 'jwt', 'refresh', 900, 604800);

  let companyId: string;
  let adminUserId: string;

  beforeEach(async () => {
    await db.query(
      'TRUNCATE oauth_states, invites, sessions, memberships, companies, users CASCADE',
    );
    companyId = randomUUID();
    adminUserId = randomUUID();
    await db.query(
      `INSERT INTO users (id, google_id, email, name) VALUES ($1, 'g-admin', 'admin@co.com', 'Admin')`,
      [adminUserId],
    );
    await db.query(`INSERT INTO companies (id, profile, number_prefix) VALUES ($1, '{}', 'CO/')`, [
      companyId,
    ]);
    await db.query(
      `INSERT INTO memberships (user_id, company_id, role, active) VALUES ($1, $2, 'admin', true)`,
      [adminUserId, companyId],
    );
  });

  test('Invite → OAuth → membership created', async () => {
    const { token } = await inviteService.create(
      { userId: adminUserId, companyId },
      'invitee@example.com',
      'employee',
    );

    // State with invite
    const state = await oauthService.createState(sha256(token));
    const { inviteTokenHash } = await oauthService.validateState(state);

    // New user authenticates
    const user = await oauthService.findOrCreateUser({
      id: 'google-invitee',
      email: 'invitee@example.com',
      name: 'Invitee',
      picture: null,
    });

    // Accept invite
    await inviteService.accept(inviteTokenHash!, { id: user.id, email: user.email });

    const [membership] = await db.query('SELECT * FROM memberships WHERE user_id = $1', [user.id]);
    assert.equal(membership.company_id, companyId);
    assert.equal(membership.role, 'employee');
  });
});

describe('Party archive with bilty reference', () => {
  const partyService = new PartyService(db);
  const biltyService = new BiltyService(db);

  let companyId: string;
  let userId: string;
  let actor: { userId: string; companyId: string };

  beforeEach(async () => {
    await db.query('TRUNCATE bilty_audit, biltys, parties, memberships, companies, users CASCADE');
    companyId = randomUUID();
    userId = randomUUID();
    actor = { userId, companyId };
    await db.query(
      `INSERT INTO users (id, google_id, email, name) VALUES ($1, 'g-1', 'u@e.com', 'U')`,
      [userId],
    );
    await db.query(`INSERT INTO companies (id, profile, number_prefix) VALUES ($1, '{}', 'PA/')`, [
      companyId,
    ]);
    await db.query(
      `INSERT INTO memberships (user_id, company_id, role, active) VALUES ($1, $2, 'admin', true)`,
      [userId, companyId],
    );
  });

  test('Archived party hidden from list but still referenceable in bilty', async () => {
    const consignor = await partyService.create(actor, 'consignor', {
      name: 'Sender',
      address: 'Delhi',
    });
    const consignee = await partyService.create(actor, 'consignee', {
      name: 'Receiver',
      address: 'Mumbai',
    });

    // Create bilty with party reference
    const bilty = await biltyService.createDraft(actor, {
      ...completeData(),
      consignor: { partyId: consignor.id, name: 'Sender', address: 'Delhi' },
      consignee: { partyId: consignee.id, name: 'Receiver', address: 'Mumbai' },
    });

    // Archive consignor
    await partyService.archive(actor, consignor.id);

    // List excludes archived
    const list = await partyService.list(actor);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, consignee.id);

    // But bilty still valid and editable
    const edited = await biltyService.edit(
      actor,
      bilty.id,
      bilty.version,
      {
        ...bilty.data,
        remarks: 'Updated',
      },
      '',
    );
    assert.equal(edited.data.consignor.partyId, consignor.id);
  });
});

describe('Cross-company denial', () => {
  const biltyService = new BiltyService(db);
  const partyService = new PartyService(db);

  let companyA: string, companyB: string;
  let userA: string, userB: string;

  beforeEach(async () => {
    await db.query('TRUNCATE bilty_audit, biltys, parties, memberships, companies, users CASCADE');
    companyA = randomUUID();
    companyB = randomUUID();
    userA = randomUUID();
    userB = randomUUID();

    for (const [cid, uid, prefix] of [
      [companyA, userA, 'A/'],
      [companyB, userB, 'B/'],
    ]) {
      await db.query(`INSERT INTO users (id, google_id, email, name) VALUES ($1, $2, $3, 'U')`, [
        uid,
        `g-${uid}`,
        `${uid}@e.com`,
      ]);
      await db.query(`INSERT INTO companies (id, profile, number_prefix) VALUES ($1, '{}', $2)`, [
        cid,
        prefix,
      ]);
      await db.query(
        `INSERT INTO memberships (user_id, company_id, role, active) VALUES ($1, $2, 'admin', true)`,
        [uid, cid],
      );
    }
  });

  test('Cannot access other company bilty', async () => {
    const actorA = { userId: userA, companyId: companyA };
    const actorB = { userId: userB, companyId: companyB };

    const bilty = await biltyService.createDraft(actorA, completeData());
    await assert.rejects(() => biltyService.get(actorB, bilty.id), /not found/i);
  });

  test('Cannot access other company party', async () => {
    const actorA = { userId: userA, companyId: companyA };
    const actorB = { userId: userB, companyId: companyB };

    const party = await partyService.create(actorA, 'consignor', { name: 'Test' });
    await assert.rejects(() => partyService.get(actorB, party.id), /not found|membership/i);
  });
});
```

- [ ] **Step 2: Add test script**

Add to `apps/api/package.json` scripts:

```json
"test:all": "node --import tsx --test test/domain.test.ts test/auth.test.ts test/party.test.ts test/integration.test.ts"
```

- [ ] **Step 3: Run all tests**

Run: `pnpm --filter @bilty/api test:integration`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/integration.test.ts apps/api/package.json
git commit -m "feat: add comprehensive auth integration tests"
```

---

## Verification Evidence

After completing all tasks, run:

```bash
pnpm typecheck && pnpm build && pnpm --filter @bilty/api test:integration
```

Expected: All typechecks, builds, and tests pass.
