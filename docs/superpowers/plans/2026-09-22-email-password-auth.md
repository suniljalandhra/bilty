# Email/Password Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email/password authentication alongside existing Google OAuth, including registration, email verification, password login, password reset, and account linking.

**Architecture:** Extend `AuthService` with password methods. Add database migration for `password_hash`, `email_verified_at` columns and `email_tokens` table. Add new public endpoints to `AuthController`. Use bcrypt for password hashing, existing token utilities for email tokens.

**Tech Stack:** NestJS, TypeORM, bcrypt, Zod, PostgreSQL

**Spec:** `docs/superpowers/specs/2026-09-22-email-password-auth-design.md`

## Global Constraints

- Password: minimum 10 characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special character
- bcrypt cost factor: 12
- Verification token expiry: 24 hours
- Reset token expiry: 1 hour
- Email service: Console logging only (no external service)
- All email endpoints return success messages regardless of whether email exists (enumeration prevention)

## Review Focus

1. **Empty password string** - Registration/login with empty string should fail validation before bcrypt
2. **Unicode in passwords** - Passwords with emoji or non-ASCII should be accepted if they meet length/character requirements
3. **Case sensitivity in email** - `User@Example.COM` and `user@example.com` should match the same account
4. **Token reuse after expiry cleanup** - Old tokens should not work even if the hash collides with a new token
5. **Concurrent password reset requests** - Multiple reset requests should invalidate previous tokens

---

## File Structure

**New Files:**

- `apps/api/src/database/migrations/1790000000003-PasswordAuth.ts` - Migration for password fields and email_tokens table
- `apps/api/src/modules/auth/password.ts` - Password validation schema and hashing utilities

**Modified Files:**

- `apps/api/src/modules/auth/auth.service.ts` - Add register, verifyEmail, loginWithPassword, forgotPassword, resetPassword, addPassword, resendVerification methods
- `apps/api/src/http/controllers.ts` - Add new endpoints to AuthController
- `apps/api/src/http/contracts.ts` - Add request body schemas
- `apps/api/test/auth-unit.test.ts` - Add password validation unit tests
- `apps/api/test/http-postgres.test.ts` - Add integration tests for all new endpoints

---

### Task 1: Database Migration

**Files:**

- Create: `apps/api/src/database/migrations/1790000000003-PasswordAuth.ts`

**Interfaces:**

- Consumes: Nothing
- Produces: Database schema changes - `users.password_hash`, `users.email_verified_at`, `email_tokens` table

- [ ] **Step 1: Create the migration file**

```typescript
// apps/api/src/database/migrations/1790000000003-PasswordAuth.ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordAuth1790000000003 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE users ADD COLUMN password_hash text;
      ALTER TABLE users ADD COLUMN email_verified_at timestamptz;

      CREATE TABLE email_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        token_hash text NOT NULL UNIQUE,
        type text NOT NULL CHECK(type IN ('verification', 'reset')),
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX email_tokens_user_idx ON email_tokens(user_id);
      CREATE INDEX email_tokens_type_idx ON email_tokens(user_id, type) WHERE used_at IS NULL;
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP TABLE email_tokens;
      ALTER TABLE users DROP COLUMN email_verified_at;
      ALTER TABLE users DROP COLUMN password_hash;
    `);
  }
}
```

- [ ] **Step 2: Verify migration compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/database/migrations/1790000000003-PasswordAuth.ts
git commit -m "feat: add password auth migration"
```

---

### Task 2: Password Utilities

**Files:**

- Create: `apps/api/src/modules/auth/password.ts`
- Modify: `apps/api/test/auth-unit.test.ts`

**Interfaces:**

- Consumes: Nothing
- Produces:
  - `passwordSchema: z.ZodString` - Zod schema for password validation
  - `hashPassword(password: string): Promise<string>` - Returns bcrypt hash
  - `verifyPassword(password: string, hash: string): Promise<boolean>` - Returns true if match

- [ ] **Step 1: Write failing tests for password validation**

Add to `apps/api/test/auth-unit.test.ts`:

```typescript
test('password validation enforces minimum 10 chars with uppercase, lowercase, number, special', async () => {
  const { passwordSchema } = await import('../src/modules/auth/password');

  // Should fail - too short
  assert.throws(() => passwordSchema.parse('Aa1!short'));

  // Should fail - no uppercase
  assert.throws(() => passwordSchema.parse('abcdefgh1!'));

  // Should fail - no lowercase
  assert.throws(() => passwordSchema.parse('ABCDEFGH1!'));

  // Should fail - no number
  assert.throws(() => passwordSchema.parse('Abcdefghi!'));

  // Should fail - no special character
  assert.throws(() => passwordSchema.parse('Abcdefghi1'));

  // Should fail - empty string
  assert.throws(() => passwordSchema.parse(''));

  // Should pass - meets all requirements
  assert.equal(passwordSchema.parse('Abcdefghi1!'), 'Abcdefghi1!');

  // Should pass - unicode/emoji allowed if requirements met
  assert.equal(passwordSchema.parse('Abcdefghi1!🎉'), 'Abcdefghi1!🎉');
});

test('password hashing produces verifiable bcrypt hash', async () => {
  const { hashPassword, verifyPassword } = await import('../src/modules/auth/password');

  const password = 'SecurePass1!';
  const hash = await hashPassword(password);

  // Hash should be bcrypt format
  assert.match(hash, /^\$2[aby]\$\d{2}\$/);

  // Correct password should verify
  assert.equal(await verifyPassword(password, hash), true);

  // Wrong password should not verify
  assert.equal(await verifyPassword('WrongPass1!', hash), false);

  // Different hashes for same password (due to salt)
  const hash2 = await hashPassword(password);
  assert.notEqual(hash, hash2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pnpm test`
Expected: FAIL with "Cannot find module '../src/modules/auth/password'"

- [ ] **Step 3: Implement password utilities**

```typescript
// apps/api/src/modules/auth/password.ts
import bcrypt from 'bcrypt';
import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

const BCRYPT_COST = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/password.ts apps/api/test/auth-unit.test.ts
git commit -m "feat: add password validation and hashing utilities"
```

---

### Task 3: Request Body Contracts

**Files:**

- Modify: `apps/api/src/http/contracts.ts`

**Interfaces:**

- Consumes: `passwordSchema` from `../modules/auth/password`
- Produces:
  - `registerBody: { email: string, password: string, name: string }`
  - `loginBody: { email: string, password: string }`
  - `tokenBody: { token: string }`
  - `emailBody: { email: string }`
  - `resetPasswordBody: { token: string, password: string }`
  - `addPasswordBody: { password: string }`

- [ ] **Step 1: Add request body schemas to contracts.ts**

Add to `apps/api/src/http/contracts.ts`:

```typescript
import { passwordSchema } from '../modules/auth/password';

export const emailSchema = z
  .string()
  .email()
  .transform((e) => e.toLowerCase().trim());

export const registerBody = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(200),
});

export const loginBody = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const tokenBody = z.strictObject({
  token: z.string().min(1).max(100),
});

export const emailBody = z.strictObject({
  email: emailSchema,
});

export const resetPasswordBody = z.strictObject({
  token: z.string().min(1).max(100),
  password: passwordSchema,
});

export const addPasswordBody = z.strictObject({
  password: passwordSchema,
});
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/http/contracts.ts
git commit -m "feat: add request body schemas for password auth"
```

---

### Task 4: Email Logger Utility

**Files:**

- Modify: `apps/api/src/modules/auth/auth.service.ts`

**Interfaces:**

- Consumes: `AuthConfig.FRONTEND_URL`
- Produces: `logEmail(type: 'verification' | 'reset', email: string, token: string): void` - Logs email to console

- [ ] **Step 1: Add email logging helper to AuthService**

Add private method to `AuthService` class in `apps/api/src/modules/auth/auth.service.ts`:

```typescript
private logEmail(type: 'verification' | 'reset', email: string, token: string) {
  const url =
    type === 'verification'
      ? `${this.config.FRONTEND_URL}/verify-email?token=${token}`
      : `${this.config.FRONTEND_URL}/reset-password?token=${token}`;
  const expiry = type === 'verification' ? '24 hours' : '1 hour';
  const subject =
    type === 'verification' ? 'Verify your Bilty account' : 'Reset your Bilty password';

  console.log(`
========================================
${type.toUpperCase()} EMAIL
To: ${email}
========================================
Subject: ${subject}

Click the link below:
${url}

This link expires in ${expiry}.
========================================
`);
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts
git commit -m "feat: add email logging utility for password auth"
```

---

### Task 5: Registration Endpoint

**Files:**

- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/http/controllers.ts`
- Modify: `apps/api/test/http-postgres.test.ts`

**Interfaces:**

- Consumes:
  - `hashPassword` from `./password`
  - `opaqueToken`, `hashToken` from `./tokens`
  - `registerBody` from `../../http/contracts`
- Produces:
  - `AuthService.register(email: string, password: string, name: string): Promise<void>`
  - `POST /auth/register` endpoint

- [ ] **Step 1: Write failing integration test**

Add to `apps/api/test/http-postgres.test.ts`:

```typescript
test('email/password registration creates unverified user and logs verification email', async () => {
  const email = 'newuser@example.com';
  const response = await request(
    '/auth/register',
    'POST',
    {
      email,
      password: 'SecurePass1!',
      name: 'New User',
    },
    '',
  );

  assert.equal(response.status, 201);
  const body = (await response.json()) as any;
  assert.equal(body.message, 'Verification email sent');

  // Should not be able to login yet (unverified)
  const loginResponse = await request(
    '/auth/login',
    'POST',
    {
      email,
      password: 'SecurePass1!',
    },
    '',
  );
  assert.equal(loginResponse.status, 403);

  // Duplicate registration should still return success (enumeration prevention)
  const duplicate = await request(
    '/auth/register',
    'POST',
    {
      email,
      password: 'DifferentPass1!',
      name: 'Duplicate',
    },
    '',
  );
  assert.equal(duplicate.status, 201);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:docker`
Expected: FAIL with 404 (endpoint not found)

- [ ] **Step 3: Implement register method in AuthService**

Add to `apps/api/src/modules/auth/auth.service.ts`:

```typescript
import { hashPassword } from './password';

// Add to AuthService class:
async register(email: string, password: string, name: string): Promise<void> {
  const passwordHash = await hashPassword(password);

  await this.db.transaction(async (tx) => {
    // Check if email already exists
    const [existing] = await tx.query('SELECT id, password_hash, google_sub FROM users WHERE email=$1', [email]);

    if (existing) {
      if (existing.password_hash) {
        // Already registered with password - silently return (enumeration prevention)
        return;
      }
      if (existing.google_sub) {
        // Google account exists - tell them to link instead
        throw new BadRequestException('Please sign in with Google and add a password from settings');
      }
    }

    // Create new user
    const userId = randomUUID();
    await tx.query(
      'INSERT INTO users(id, email, name, password_hash, email_verified_at) VALUES($1, $2, $3, $4, NULL)',
      [userId, email, name, passwordHash]
    );

    // Create verification token
    const token = opaqueToken();
    await tx.query(
      "INSERT INTO email_tokens(user_id, token_hash, type, expires_at) VALUES($1, $2, 'verification', now() + interval '24 hours')",
      [userId, hashToken(token)]
    );

    this.logEmail('verification', email, token);
  });
}
```

- [ ] **Step 4: Add register endpoint to AuthController**

Add to `apps/api/src/http/controllers.ts`:

```typescript
import { registerBody } from './contracts';

// Add to AuthController class:
@Public() @Post('register') @HttpCode(201) async register(@Body() raw: unknown) {
  const { email, password, name } = registerBody.parse(raw);
  await this.auth.register(email, password, name);
  return { message: 'Verification email sent' };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:docker`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/http/controllers.ts apps/api/test/http-postgres.test.ts
git commit -m "feat: add email/password registration endpoint"
```

---

### Task 6: Email Verification Endpoint

**Files:**

- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/http/controllers.ts`
- Modify: `apps/api/test/http-postgres.test.ts`

**Interfaces:**

- Consumes:
  - `tokenPattern`, `hashToken` from `./tokens`
  - `tokenBody` from `../../http/contracts`
  - `createSession` (existing private method)
- Produces:
  - `AuthService.verifyEmail(token: string): Promise<Tokens>`
  - `POST /auth/verify-email` endpoint

- [ ] **Step 1: Write failing integration test**

Add to `apps/api/test/http-postgres.test.ts`:

```typescript
test('email verification validates token, marks email verified, and auto-logs in', async () => {
  // Register a new user (capture console to get token)
  const email = 'verify@example.com';
  let capturedToken = '';
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    const msg = args.join(' ');
    const match = msg.match(/verify-email\?token=([A-Za-z0-9_-]+)/);
    if (match) capturedToken = match[1];
    originalLog(...args);
  };

  await request(
    '/auth/register',
    'POST',
    {
      email,
      password: 'SecurePass1!',
      name: 'Verify User',
    },
    '',
  );

  console.log = originalLog;
  assert.ok(capturedToken, 'Should capture verification token from console');

  // Invalid token should fail
  const badResponse = await request('/auth/verify-email', 'POST', { token: 'invalid-token' }, '');
  assert.equal(badResponse.status, 400);

  // Valid token should verify and return access token
  const response = await request('/auth/verify-email', 'POST', { token: capturedToken }, '');
  assert.equal(response.status, 200);
  const body = (await response.json()) as any;
  assert.ok(body.accessToken);
  assert.equal(body.expiresIn, 900);

  // Token should be single-use
  const reuse = await request('/auth/verify-email', 'POST', { token: capturedToken }, '');
  assert.equal(reuse.status, 400);

  // Should now be able to login with password
  const loginResponse = await request(
    '/auth/login',
    'POST',
    {
      email,
      password: 'SecurePass1!',
    },
    '',
  );
  assert.equal(loginResponse.status, 200);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:docker`
Expected: FAIL

- [ ] **Step 3: Implement verifyEmail method in AuthService**

Add to `apps/api/src/modules/auth/auth.service.ts`:

```typescript
async verifyEmail(token: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: string }> {
  if (!tokenPattern.test(token)) throw new BadRequestException('Invalid verification token');

  return this.db.transaction(async (tx) => {
    // Find and consume the token
    const [emailToken] = await tx.query(
      "DELETE FROM email_tokens WHERE token_hash=$1 AND type='verification' AND used_at IS NULL AND expires_at > now() RETURNING user_id",
      [hashToken(token)]
    );

    if (!emailToken) throw new BadRequestException('Invalid or expired verification token');

    // Mark email as verified
    await tx.query('UPDATE users SET email_verified_at=now() WHERE id=$1', [emailToken.user_id]);

    // Create session (auto-login)
    return this.createSession(tx, emailToken.user_id);
  });
}
```

- [ ] **Step 4: Add verify-email endpoint to AuthController**

Add to `apps/api/src/http/controllers.ts`:

```typescript
import { tokenBody } from './contracts';

// Add to AuthController class:
@Public() @Post('verify-email') @HttpCode(200) async verifyEmail(
  @Body() raw: unknown,
  @Res({ passthrough: true }) res: Response,
) {
  const { token } = tokenBody.parse(raw);
  const tokens = await this.auth.verifyEmail(token);
  this.setRefresh(res, tokens);
  return { accessToken: tokens.accessToken, expiresIn: 900 };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:docker`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/http/controllers.ts apps/api/test/http-postgres.test.ts
git commit -m "feat: add email verification endpoint"
```

---

### Task 7: Password Login Endpoint

**Files:**

- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/http/controllers.ts`
- Modify: `apps/api/test/http-postgres.test.ts`

**Interfaces:**

- Consumes:
  - `verifyPassword` from `./password`
  - `loginBody` from `../../http/contracts`
  - `createSession` (existing private method)
- Produces:
  - `AuthService.loginWithPassword(email: string, password: string): Promise<Tokens>`
  - `POST /auth/login` endpoint

- [ ] **Step 1: Write failing integration test**

Add to `apps/api/test/http-postgres.test.ts`:

```typescript
test('password login validates credentials, checks verification status, and returns tokens', async () => {
  // Register and verify a user first
  const email = 'logintest@example.com';
  let capturedToken = '';
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    const msg = args.join(' ');
    const match = msg.match(/verify-email\?token=([A-Za-z0-9_-]+)/);
    if (match) capturedToken = match[1];
    originalLog(...args);
  };

  await request(
    '/auth/register',
    'POST',
    {
      email,
      password: 'SecurePass1!',
      name: 'Login Test',
    },
    '',
  );
  console.log = originalLog;

  // Login before verification should fail
  const unverified = await request('/auth/login', 'POST', { email, password: 'SecurePass1!' }, '');
  assert.equal(unverified.status, 403);
  assert.match(((await unverified.json()) as any).message, /verify/i);

  // Verify email
  await request('/auth/verify-email', 'POST', { token: capturedToken }, '');

  // Wrong password should fail with generic message
  const wrongPass = await request('/auth/login', 'POST', { email, password: 'WrongPass1!' }, '');
  assert.equal(wrongPass.status, 401);
  assert.match(((await wrongPass.json()) as any).message, /invalid email or password/i);

  // Non-existent email should fail with same generic message
  const noUser = await request(
    '/auth/login',
    'POST',
    { email: 'nobody@example.com', password: 'SecurePass1!' },
    '',
  );
  assert.equal(noUser.status, 401);
  assert.match(((await noUser.json()) as any).message, /invalid email or password/i);

  // Correct credentials should succeed
  const login = await request('/auth/login', 'POST', { email, password: 'SecurePass1!' }, '');
  assert.equal(login.status, 200);
  const body = (await login.json()) as any;
  assert.ok(body.accessToken);
  assert.equal(body.expiresIn, 900);

  // Access token should work
  const me = await request('/auth/me', 'GET', undefined, body.accessToken);
  assert.equal(me.status, 200);
  assert.equal(((await me.json()) as any).email, email);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:docker`
Expected: FAIL

- [ ] **Step 3: Implement loginWithPassword method in AuthService**

Add to `apps/api/src/modules/auth/auth.service.ts`:

```typescript
import { verifyPassword } from './password';

async loginWithPassword(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: string }> {
  const [user] = await this.db.query(
    'SELECT id, password_hash, email_verified_at, google_sub FROM users WHERE email=$1',
    [email]
  );

  if (!user || !user.password_hash) {
    // No user or no password set - use generic message
    if (user?.google_sub) {
      throw new UnauthorizedException('Please sign in with Google');
    }
    throw new UnauthorizedException('Invalid email or password');
  }

  if (!user.email_verified_at) {
    throw new ForbiddenException('Please verify your email first');
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw new UnauthorizedException('Invalid email or password');
  }

  return this.db.transaction(async (tx) => this.createSession(tx, user.id));
}
```

- [ ] **Step 4: Add login endpoint to AuthController**

Add to `apps/api/src/http/controllers.ts`:

```typescript
import { loginBody } from './contracts';

// Add to AuthController class:
@Public() @Post('login') @HttpCode(200) async login(
  @Body() raw: unknown,
  @Res({ passthrough: true }) res: Response,
) {
  const { email, password } = loginBody.parse(raw);
  const tokens = await this.auth.loginWithPassword(email, password);
  this.setRefresh(res, tokens);
  return { accessToken: tokens.accessToken, expiresIn: 900 };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:docker`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/http/controllers.ts apps/api/test/http-postgres.test.ts
git commit -m "feat: add password login endpoint"
```

---

### Task 8: Forgot Password Endpoint

**Files:**

- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/http/controllers.ts`
- Modify: `apps/api/test/http-postgres.test.ts`

**Interfaces:**

- Consumes:
  - `opaqueToken`, `hashToken` from `./tokens`
  - `emailBody` from `../../http/contracts`
- Produces:
  - `AuthService.forgotPassword(email: string): Promise<void>`
  - `POST /auth/forgot-password` endpoint

- [ ] **Step 1: Write failing integration test**

Add to `apps/api/test/http-postgres.test.ts`:

```typescript
test('forgot password sends reset email for existing password users, silently ignores others', async () => {
  // Create and verify a password user
  const email = 'forgot@example.com';
  let verifyToken = '';
  let resetToken = '';
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    const msg = args.join(' ');
    let match = msg.match(/verify-email\?token=([A-Za-z0-9_-]+)/);
    if (match) verifyToken = match[1];
    match = msg.match(/reset-password\?token=([A-Za-z0-9_-]+)/);
    if (match) resetToken = match[1];
    originalLog(...args);
  };

  await request(
    '/auth/register',
    'POST',
    { email, password: 'SecurePass1!', name: 'Forgot User' },
    '',
  );
  await request('/auth/verify-email', 'POST', { token: verifyToken }, '');

  // Request password reset
  const response = await request('/auth/forgot-password', 'POST', { email }, '');
  assert.equal(response.status, 200);
  assert.ok(resetToken, 'Reset token should be logged');

  // Non-existent email should return same response (enumeration prevention)
  const noUser = await request(
    '/auth/forgot-password',
    'POST',
    { email: 'nobody@example.com' },
    '',
  );
  assert.equal(noUser.status, 200);

  // Google-only user should return same response (enumeration prevention)
  const googleUser = await request('/auth/forgot-password', 'POST', { email: 'a@example.com' }, '');
  assert.equal(googleUser.status, 200);

  console.log = originalLog;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:docker`
Expected: FAIL

- [ ] **Step 3: Implement forgotPassword method in AuthService**

Add to `apps/api/src/modules/auth/auth.service.ts`:

```typescript
async forgotPassword(email: string): Promise<void> {
  const [user] = await this.db.query(
    'SELECT id, email FROM users WHERE email=$1 AND password_hash IS NOT NULL',
    [email]
  );

  if (!user) {
    // Silently return to prevent enumeration
    return;
  }

  await this.db.transaction(async (tx) => {
    // Invalidate existing reset tokens
    await tx.query(
      "DELETE FROM email_tokens WHERE user_id=$1 AND type='reset' AND used_at IS NULL",
      [user.id]
    );

    // Create new reset token
    const token = opaqueToken();
    await tx.query(
      "INSERT INTO email_tokens(user_id, token_hash, type, expires_at) VALUES($1, $2, 'reset', now() + interval '1 hour')",
      [user.id, hashToken(token)]
    );

    this.logEmail('reset', user.email, token);
  });
}
```

- [ ] **Step 4: Add forgot-password endpoint to AuthController**

Add to `apps/api/src/http/controllers.ts`:

```typescript
import { emailBody } from './contracts';

// Add to AuthController class:
@Public() @Post('forgot-password') @HttpCode(200) async forgotPassword(@Body() raw: unknown) {
  const { email } = emailBody.parse(raw);
  await this.auth.forgotPassword(email);
  return { message: 'If account exists, reset email sent' };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:docker`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/http/controllers.ts apps/api/test/http-postgres.test.ts
git commit -m "feat: add forgot password endpoint"
```

---

### Task 9: Reset Password Endpoint

**Files:**

- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/http/controllers.ts`
- Modify: `apps/api/test/http-postgres.test.ts`

**Interfaces:**

- Consumes:
  - `hashPassword` from `./password`
  - `tokenPattern`, `hashToken` from `./tokens`
  - `resetPasswordBody` from `../../http/contracts`
- Produces:
  - `AuthService.resetPassword(token: string, newPassword: string): Promise<void>`
  - `POST /auth/reset-password` endpoint

- [ ] **Step 1: Write failing integration test**

Add to `apps/api/test/http-postgres.test.ts`:

```typescript
test('reset password validates token, updates password, and revokes all sessions', async () => {
  // Create and verify a password user
  const email = 'reset@example.com';
  let verifyToken = '';
  let resetToken = '';
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    const msg = args.join(' ');
    let match = msg.match(/verify-email\?token=([A-Za-z0-9_-]+)/);
    if (match) verifyToken = match[1];
    match = msg.match(/reset-password\?token=([A-Za-z0-9_-]+)/);
    if (match) resetToken = match[1];
    originalLog(...args);
  };

  await request(
    '/auth/register',
    'POST',
    { email, password: 'OldPassword1!', name: 'Reset User' },
    '',
  );
  const verifyResponse = await request('/auth/verify-email', 'POST', { token: verifyToken }, '');
  const { accessToken } = (await verifyResponse.json()) as any;

  // Request password reset
  await request('/auth/forgot-password', 'POST', { email }, '');
  console.log = originalLog;

  // Invalid token should fail
  const badToken = await request(
    '/auth/reset-password',
    'POST',
    { token: 'invalid', password: 'NewPassword1!' },
    '',
  );
  assert.equal(badToken.status, 400);

  // Valid token should succeed
  const reset = await request(
    '/auth/reset-password',
    'POST',
    { token: resetToken, password: 'NewPassword1!' },
    '',
  );
  assert.equal(reset.status, 200);

  // Old session should be revoked
  const oldSession = await request('/auth/me', 'GET', undefined, accessToken);
  assert.equal(oldSession.status, 401);

  // Old password should not work
  const oldPass = await request('/auth/login', 'POST', { email, password: 'OldPassword1!' }, '');
  assert.equal(oldPass.status, 401);

  // New password should work
  const newPass = await request('/auth/login', 'POST', { email, password: 'NewPassword1!' }, '');
  assert.equal(newPass.status, 200);

  // Token should be single-use
  const reuse = await request(
    '/auth/reset-password',
    'POST',
    { token: resetToken, password: 'AnotherPass1!' },
    '',
  );
  assert.equal(reuse.status, 400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:docker`
Expected: FAIL

- [ ] **Step 3: Implement resetPassword method in AuthService**

Add to `apps/api/src/modules/auth/auth.service.ts`:

```typescript
async resetPassword(token: string, newPassword: string): Promise<void> {
  if (!tokenPattern.test(token)) throw new BadRequestException('Invalid reset token');

  const passwordHash = await hashPassword(newPassword);

  await this.db.transaction(async (tx) => {
    // Find and consume the token
    const [emailToken] = await tx.query(
      "DELETE FROM email_tokens WHERE token_hash=$1 AND type='reset' AND used_at IS NULL AND expires_at > now() RETURNING user_id",
      [hashToken(token)]
    );

    if (!emailToken) throw new BadRequestException('Invalid or expired reset token');

    // Update password
    await tx.query('UPDATE users SET password_hash=$2 WHERE id=$1', [emailToken.user_id, passwordHash]);

    // Revoke all sessions (security measure)
    await tx.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [emailToken.user_id]);
  });
}
```

- [ ] **Step 4: Add reset-password endpoint to AuthController**

Add to `apps/api/src/http/controllers.ts`:

```typescript
import { resetPasswordBody } from './contracts';

// Add to AuthController class:
@Public() @Post('reset-password') @HttpCode(200) async resetPassword(@Body() raw: unknown) {
  const { token, password } = resetPasswordBody.parse(raw);
  await this.auth.resetPassword(token, password);
  return { message: 'Password updated' };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:docker`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/http/controllers.ts apps/api/test/http-postgres.test.ts
git commit -m "feat: add reset password endpoint"
```

---

### Task 10: Add Password Endpoint (Account Linking)

**Files:**

- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/http/controllers.ts`
- Modify: `apps/api/test/http-postgres.test.ts`

**Interfaces:**

- Consumes:
  - `hashPassword` from `./password`
  - `addPasswordBody` from `../../http/contracts`
  - `Principal` type
- Produces:
  - `AuthService.addPassword(principal: Principal, password: string): Promise<void>`
  - `POST /auth/add-password` endpoint (authenticated)

- [ ] **Step 1: Write failing integration test**

Add to `apps/api/test/http-postgres.test.ts`:

```typescript
test('add-password allows Google users to set a password for dual login', async () => {
  // Use existing Google user from setup (token is for a@example.com)

  // Add password (requires authentication)
  const addPass = await request('/auth/add-password', 'POST', { password: 'GooglePass1!' }, token);
  assert.equal(addPass.status, 200);

  // Should now be able to login with password
  const login = await request(
    '/auth/login',
    'POST',
    { email: 'a@example.com', password: 'GooglePass1!' },
    '',
  );
  assert.equal(login.status, 200);

  // Adding password again should fail
  const duplicate = await request(
    '/auth/add-password',
    'POST',
    { password: 'AnotherPass1!' },
    token,
  );
  assert.equal(duplicate.status, 409);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:docker`
Expected: FAIL

- [ ] **Step 3: Implement addPassword method in AuthService**

Add to `apps/api/src/modules/auth/auth.service.ts`:

```typescript
async addPassword(p: Principal, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);

  await this.db.transaction(async (tx) => {
    const [user] = await tx.query('SELECT password_hash, google_sub FROM users WHERE id=$1 FOR UPDATE', [p.userId]);

    if (!user) throw new UnauthorizedException();

    if (user.password_hash) {
      throw new ConflictException('Password already set');
    }

    if (!user.google_sub) {
      throw new BadRequestException('Account must have Google sign-in to add password');
    }

    // Set password and mark email as verified (Google already verified it)
    await tx.query(
      'UPDATE users SET password_hash=$2, email_verified_at=COALESCE(email_verified_at, now()) WHERE id=$1',
      [p.userId, passwordHash]
    );
  });
}
```

- [ ] **Step 4: Add add-password endpoint to AuthController**

Add to `apps/api/src/http/controllers.ts`:

```typescript
import { addPasswordBody } from './contracts';

// Add to AuthController class:
@Post('add-password') @HttpCode(200) async addPassword(
  @Req() req: AuthedRequest,
  @Body() raw: unknown,
) {
  const { password } = addPasswordBody.parse(raw);
  await this.auth.addPassword(req.principal, password);
  return { message: 'Password added' };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:docker`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/http/controllers.ts apps/api/test/http-postgres.test.ts
git commit -m "feat: add password linking endpoint for Google users"
```

---

### Task 11: Resend Verification Endpoint

**Files:**

- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/http/controllers.ts`
- Modify: `apps/api/test/http-postgres.test.ts`

**Interfaces:**

- Consumes:
  - `opaqueToken`, `hashToken` from `./tokens`
  - `emailBody` from `../../http/contracts`
- Produces:
  - `AuthService.resendVerification(email: string): Promise<void>`
  - `POST /auth/resend-verification` endpoint

- [ ] **Step 1: Write failing integration test**

Add to `apps/api/test/http-postgres.test.ts`:

```typescript
test('resend-verification sends new token for unverified password users', async () => {
  const email = 'resend@example.com';
  let firstToken = '';
  let secondToken = '';
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    const msg = args.join(' ');
    const match = msg.match(/verify-email\?token=([A-Za-z0-9_-]+)/);
    if (match) {
      if (!firstToken) firstToken = match[1];
      else secondToken = match[1];
    }
    originalLog(...args);
  };

  // Register (generates first token)
  await request(
    '/auth/register',
    'POST',
    { email, password: 'SecurePass1!', name: 'Resend User' },
    '',
  );

  // Resend verification
  const resend = await request('/auth/resend-verification', 'POST', { email }, '');
  assert.equal(resend.status, 200);
  assert.ok(secondToken, 'New token should be logged');
  assert.notEqual(firstToken, secondToken, 'Should generate new token');

  console.log = originalLog;

  // First token should no longer work (invalidated)
  const oldToken = await request('/auth/verify-email', 'POST', { token: firstToken }, '');
  assert.equal(oldToken.status, 400);

  // New token should work
  const newToken = await request('/auth/verify-email', 'POST', { token: secondToken }, '');
  assert.equal(newToken.status, 200);

  // Resend for verified user should silently succeed
  const alreadyVerified = await request('/auth/resend-verification', 'POST', { email }, '');
  assert.equal(alreadyVerified.status, 200);

  // Resend for non-existent user should silently succeed (enumeration prevention)
  const noUser = await request(
    '/auth/resend-verification',
    'POST',
    { email: 'nobody@example.com' },
    '',
  );
  assert.equal(noUser.status, 200);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:docker`
Expected: FAIL

- [ ] **Step 3: Implement resendVerification method in AuthService**

Add to `apps/api/src/modules/auth/auth.service.ts`:

```typescript
async resendVerification(email: string): Promise<void> {
  const [user] = await this.db.query(
    'SELECT id, email FROM users WHERE email=$1 AND password_hash IS NOT NULL AND email_verified_at IS NULL',
    [email]
  );

  if (!user) {
    // Silently return to prevent enumeration
    return;
  }

  await this.db.transaction(async (tx) => {
    // Invalidate existing verification tokens
    await tx.query(
      "DELETE FROM email_tokens WHERE user_id=$1 AND type='verification' AND used_at IS NULL",
      [user.id]
    );

    // Create new verification token
    const token = opaqueToken();
    await tx.query(
      "INSERT INTO email_tokens(user_id, token_hash, type, expires_at) VALUES($1, $2, 'verification', now() + interval '24 hours')",
      [user.id, hashToken(token)]
    );

    this.logEmail('verification', user.email, token);
  });
}
```

- [ ] **Step 4: Add resend-verification endpoint to AuthController**

Add to `apps/api/src/http/controllers.ts`:

```typescript
// Add to AuthController class:
@Public() @Post('resend-verification') @HttpCode(200) async resendVerification(@Body() raw: unknown) {
  const { email } = emailBody.parse(raw);
  await this.auth.resendVerification(email);
  return { message: 'If account exists and unverified, email sent' };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:docker`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/http/controllers.ts apps/api/test/http-postgres.test.ts
git commit -m "feat: add resend verification endpoint"
```

---

### Task 12: Final Integration Test and Cleanup

**Files:**

- Modify: `apps/api/test/http-postgres.test.ts`

**Interfaces:**

- Consumes: All previously implemented endpoints
- Produces: Comprehensive integration test coverage

- [ ] **Step 1: Add comprehensive flow test**

Add to `apps/api/test/http-postgres.test.ts`:

```typescript
test('email case normalization treats upper and lower case as same account', async () => {
  const email = 'CaseTest@Example.COM';
  let verifyToken = '';
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    const msg = args.join(' ');
    const match = msg.match(/verify-email\?token=([A-Za-z0-9_-]+)/);
    if (match) verifyToken = match[1];
    originalLog(...args);
  };

  // Register with mixed case
  await request(
    '/auth/register',
    'POST',
    { email, password: 'SecurePass1!', name: 'Case User' },
    '',
  );
  await request('/auth/verify-email', 'POST', { token: verifyToken }, '');

  console.log = originalLog;

  // Login with lowercase should work
  const login = await request(
    '/auth/login',
    'POST',
    { email: 'casetest@example.com', password: 'SecurePass1!' },
    '',
  );
  assert.equal(login.status, 200);

  // Login with uppercase should work
  const loginUpper = await request(
    '/auth/login',
    'POST',
    { email: 'CASETEST@EXAMPLE.COM', password: 'SecurePass1!' },
    '',
  );
  assert.equal(loginUpper.status, 200);
});
```

- [ ] **Step 2: Run full test suite**

Run: `pnpm test:docker`
Expected: All tests PASS

- [ ] **Step 3: Run type check**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 4: Run lint and format**

Run: `pnpm check`
Expected: All checks pass

- [ ] **Step 5: Commit**

```bash
git add apps/api/test/http-postgres.test.ts
git commit -m "test: add email case normalization test"
```

---

## Summary

This plan implements email/password authentication in 12 tasks:

1. **Database Migration** - Schema changes for password fields and email_tokens
2. **Password Utilities** - Validation schema and bcrypt hashing
3. **Request Contracts** - Zod schemas for all request bodies
4. **Email Logger** - Console output for verification/reset emails
5. **Registration** - Create unverified users with password
6. **Email Verification** - Verify email and auto-login
7. **Password Login** - Authenticate with email/password
8. **Forgot Password** - Request reset token
9. **Reset Password** - Set new password with token
10. **Add Password** - Link password to Google account
11. **Resend Verification** - Re-send verification email
12. **Final Tests** - Integration tests and cleanup

Each task produces working, tested code that can be committed independently.
