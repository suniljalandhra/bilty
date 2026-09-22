# Email/Password Authentication Design

**Date:** 2026-09-22
**Status:** Draft
**Scope:** Add email/password authentication alongside existing Google OAuth

## Overview

Extend the existing authentication system to support email/password login as an alternative to Google OAuth. Users can register with email/password, or add a password to an existing Google account for flexible sign-in options.

## Requirements

### Functional Requirements

1. **Registration:** New users can register with email, password, and name
2. **Email Verification:** Required before first login (verification link sent to email)
3. **Password Login:** Verified users can sign in with email/password
4. **Password Reset:** Users can request a reset link sent to their email
5. **Account Linking:** Google OAuth users can add a password to sign in with either method
6. **Resend Verification:** Users can request a new verification email

### Password Requirements

- Minimum 10 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

### Email Service

Console logging for V1 (emails logged to stdout). Real email service to be added later.

## Database Changes

### Migration: Add Password Fields

```sql
-- Users table additions
ALTER TABLE users ADD COLUMN password_hash text;
ALTER TABLE users ADD COLUMN email_verified_at timestamptz;

-- New email_tokens table
CREATE TABLE email_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  token_hash text NOT NULL UNIQUE,
  type text NOT NULL CHECK(type IN ('verification', 'reset')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_tokens_user_idx ON email_tokens(user_id);
```

### Constraints

- User can sign in with email/password only if `password_hash IS NOT NULL AND email_verified_at IS NOT NULL`
- Google OAuth users have `google_sub IS NOT NULL` (existing)
- A user can have both (linked account)

## API Endpoints

All under `/auth` controller, extending existing `AuthController`.

### Public Endpoints

| Method | Endpoint                    | Description                  |
| ------ | --------------------------- | ---------------------------- |
| POST   | `/auth/register`            | Register with email/password |
| POST   | `/auth/verify-email`        | Verify email with token      |
| POST   | `/auth/login`               | Login with email/password    |
| POST   | `/auth/forgot-password`     | Request password reset       |
| POST   | `/auth/reset-password`      | Set new password with token  |
| POST   | `/auth/resend-verification` | Resend verification email    |

### Authenticated Endpoints

| Method | Endpoint             | Description                    |
| ------ | -------------------- | ------------------------------ |
| POST   | `/auth/add-password` | Add password to Google account |

### Request/Response Contracts

```typescript
// POST /auth/register
Request: { email: string, password: string, name: string }
Response: { message: "Verification email sent" }

// POST /auth/verify-email
Request: { token: string }
Response: { accessToken: string, expiresIn: number } + bilty_refresh cookie

// POST /auth/login
Request: { email: string, password: string }
Response: { accessToken: string, expiresIn: number } + bilty_refresh cookie

// POST /auth/forgot-password
Request: { email: string }
Response: { message: "If account exists, reset email sent" }

// POST /auth/reset-password
Request: { token: string, password: string }
Response: { message: "Password updated" }

// POST /auth/add-password (requires authentication)
Request: { password: string }
Response: { message: "Password added" }

// POST /auth/resend-verification
Request: { email: string }
Response: { message: "If account exists and unverified, email sent" }
```

## AuthService Extensions

### New Methods

```typescript
// Registration - creates unverified user, sends verification email
async register(email: string, password: string, name: string): Promise<void>

// Email verification - verifies email, auto-logs in user
async verifyEmail(token: string): Promise<Tokens>

// Password login - authenticates with email/password
async loginWithPassword(email: string, password: string): Promise<Tokens>

// Password reset request - sends reset email if account exists
async forgotPassword(email: string): Promise<void>

// Password reset execution - sets new password, revokes all sessions
async resetPassword(token: string, newPassword: string): Promise<void>

// Add password to Google account
async addPassword(principal: Principal, password: string): Promise<void>

// Resend verification email
async resendVerification(email: string): Promise<void>
```

### Password Validation

```typescript
const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');
```

### Method Logic

**register(email, password, name):**

1. Validate password strength
2. Normalize email (lowercase, trim)
3. Check if email exists with password_hash set → BadRequestException
4. Check if email exists with Google only → BadRequestException ("Please sign in with Google and add a password")
5. Hash password with bcrypt (cost 12)
6. Create user with password_hash, email_verified_at = null
7. Generate verification token (32 bytes random)
8. Store token hash in email_tokens (type='verification', expires in 24h)
9. Log verification link to console

**verifyEmail(token):**

1. Validate token format
2. Find token in email_tokens (type='verification', used_at IS NULL, expires_at > now())
3. If not found → BadRequestException
4. Mark token as used (used_at = now())
5. Set user.email_verified_at = now()
6. Create session and return tokens (auto-login)

**loginWithPassword(email, password):**

1. Normalize email
2. Find user by email
3. If not found → UnauthorizedException ("Invalid email or password")
4. If password_hash is null → UnauthorizedException ("Please sign in with Google")
5. If email_verified_at is null → ForbiddenException ("Please verify your email first")
6. Verify password with bcrypt.compare()
7. If invalid → UnauthorizedException ("Invalid email or password")
8. Create session and return tokens

**forgotPassword(email):**

1. Normalize email
2. Find user by email with password_hash IS NOT NULL
3. If not found → return silently (prevent enumeration)
4. Delete existing unused reset tokens for user
5. Generate reset token
6. Store token hash in email_tokens (type='reset', expires in 1h)
7. Log reset link to console

**resetPassword(token, newPassword):**

1. Validate password strength
2. Find token in email_tokens (type='reset', used_at IS NULL, expires_at > now())
3. If not found → BadRequestException
4. Mark token as used
5. Hash new password with bcrypt
6. Update user.password_hash
7. Revoke all user sessions (security measure)

**addPassword(principal, password):**

1. Validate password strength
2. Find user by principal.userId
3. If password_hash is not null → ConflictException ("Password already set")
4. Hash password with bcrypt
5. Set password_hash
6. Set email_verified_at = now() (Google already verified the email)

**resendVerification(email):**

1. Normalize email
2. Find user by email with password_hash IS NOT NULL AND email_verified_at IS NULL
3. If not found → return silently
4. Delete existing unused verification tokens for user
5. Generate new verification token
6. Store in email_tokens (type='verification', expires in 24h)
7. Log verification link to console

## Security Considerations

### Token Security

- Tokens: 32-byte random using existing `opaqueToken()` function
- Storage: SHA-256 hash only (using existing `hashToken()`)
- Verification tokens: 24-hour expiry
- Reset tokens: 1-hour expiry
- Single-use: marked with `used_at` timestamp on consumption

### Password Security

- bcrypt with cost factor 12 (~250ms hash time)
- Passwords never logged or returned in responses
- Not stored in sessions or JWTs

### Account Enumeration Prevention

- `/auth/register`: Always returns "Verification email sent"
- `/auth/forgot-password`: Always returns success message
- `/auth/resend-verification`: Always returns success message
- `/auth/login`: Generic "Invalid email or password" on any failure

### Session Invalidation

- Password reset revokes ALL user sessions
- Adding password does NOT revoke sessions (user already authenticated)

### Rate Limiting

Not implemented in V1 (console-only emails). Add before enabling real email service:

- Registration: 5/hour per IP
- Login: 10/minute per IP, lockout after 5 failures
- Password reset: 3/hour per email
- Verification resend: 3/hour per email

## Email Templates (Console Output)

### Verification Email

```
========================================
VERIFICATION EMAIL
To: {email}
========================================
Subject: Verify your Bilty account

Click the link below to verify your email:
{FRONTEND_URL}/verify-email?token={token}

This link expires in 24 hours.
========================================
```

### Password Reset Email

```
========================================
PASSWORD RESET EMAIL
To: {email}
========================================
Subject: Reset your Bilty password

Click the link below to reset your password:
{FRONTEND_URL}/reset-password?token={token}

This link expires in 1 hour.
If you didn't request this, ignore this email.
========================================
```

## Frontend Integration

### New Routes

| Route              | Purpose                                         |
| ------------------ | ----------------------------------------------- |
| `/login`           | Add email/password form alongside Google button |
| `/register`        | Registration form (email, password, name)       |
| `/verify-email`    | Handle verification link, show success/error    |
| `/forgot-password` | Request password reset form                     |
| `/reset-password`  | Set new password form                           |
| `/settings`        | Add "Set Password" for Google-only users        |

### Login Page Changes

- Add email/password form fields above or below Google button
- Add "Forgot password?" link
- Add "Create account" link
- Handle error states: "Email not verified" with resend option

### Password Field UX

- Show/hide password toggle
- Real-time strength indicator
- Display requirements inline

## Testing Strategy

### Unit Tests

- Password validation (all rules)
- Token generation and hashing
- Each AuthService method with mocked database

### Integration Tests

- Full registration → verification → login flow
- Password reset flow
- Account linking flow
- Error cases: duplicate email, invalid token, expired token
- Session invalidation on password reset

## Migration Path

1. Deploy database migration (adds columns, creates table)
2. Deploy backend with new endpoints
3. Deploy frontend with new pages
4. Existing Google OAuth users unaffected
5. New users can choose registration method

## Future Considerations

- Real email service integration (Resend, SendGrid, SES)
- Rate limiting implementation
- "Remember me" functionality
- Two-factor authentication
- Social login expansion (Apple, Microsoft)
