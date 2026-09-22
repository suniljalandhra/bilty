# Auth & HTTP Slice Design Spec

Approved direction: 21 September 2026. This revision incorporates the repository review and is the auth implementation contract. The later complete-v1-design.md extends it with the frontend, PDFs and shares.

## Scope and architecture

NestJS HTTP API, Google OpenID Connect, PostgreSQL-backed sessions, invitations, self-service company setup, company/member/party endpoints and authenticated bilty lifecycle. Preserve TypeORM's explicit migrations and existing parameterized SQL services; do not introduce incompatible ORM entities. Next.js, email delivery, PDFs, uploads and assisted/platform-admin onboarding are deferred. V1 supports one company per user, including revoked memberships; moving companies requires a later administrative workflow.

## Compatible persistence

Keep companies(profile JSONB, number_prefix, next_number), memberships(user_id primary key, company_id, role, active), parties(snapshot JSONB, kind) and all bilty/audit columns unchanged. Add users(id, normalized nullable unique email, nullable unique google_sub, name, avatar_url, timestamps); backfill identity-less users for existing membership IDs before adding the foreign key. Never automatically link a Google login to these legacy identities by email. Existing operators need a separate trusted identity reconciliation before real deployment.

Add memberships.joined_at/revoked_at and parties.archived_at. Add sessions(id, user_id, expires_at, revoked_at, created_at), refresh_tokens(token_hash primary key, session_id, used_at, created_at), invites(id, company_id, normalized email, role, token_hash unique, expires_at, accepted_at, revoked_at, invited_by, created_at), oauth_states(state_hash primary key, browser_hash, nonce_hash, code_verifier, invite_hash, expires_at). All bearer tokens are 32 random bytes encoded base64url and only SHA-256 hashes persist. The short-lived PKCE verifier must remain recoverable for code exchange and is deleted with the state. Explicit migration rollback removes only auth additions; never drops foundation data. Number counters and issued snapshots survive upgrade.

## Google login and onboarding

GET /auth/google creates a ten-minute, single-use state, random browser binding cookie, nonce and S256 PKCE challenge. Optional invite token is hashed and bound in server-side state. State must match both callback and browser cookie and be unexpired; consume it atomically before exchange. Use Google OAuth2Client for code exchange and signature/issuer/audience/expiry validation. Require sub, email_verified, email and matching nonce. Use sub as identity; email is not an account-linking key.

Callback upserts identity by sub inside a transaction. A supplied invite must be unexpired, unrevoked and unused with exact normalized verified email. Lock invite and consume it in the same transaction as membership creation/reactivation. Existing membership in another company returns 409; active same-company membership returns 409; revoked same-company membership can be reactivated explicitly by an invite. Without an invite, revoked membership returns 403. New identity without a membership gets an onboarding session. Repeated login must not create duplicate companies.

POST /auth/onboard with bearer access token and {profile, numberPrefix} creates company and admin membership transactionally once; profile.name is required, other print fields follow the existing CompanySnapshot contract. Existing membership returns 409. Counter always starts at 1; never writable by clients. Company settings can subsequently update profile or prefix; issued snapshots stay unchanged.

Callback sets refresh cookie and redirects only to configured FRONTEND_URL + /auth/callback. No credentials in redirect URLs. The frontend POSTs /auth/refresh and keeps the returned access token in memory. Google credentials and registered callback must be configured by the operator; tests replace only the external Google provider.

## Sessions and authorization

Access JWT: HS256 only, 15 minutes, fixed issuer bilty-api and audience bilty-web, sub=userId, sid=sessionId. No authoritative company/role claims: every authenticated request resolves live session and membership from PostgreSQL. Onboarding tokens permit /auth/me, /auth/onboard and logout/refresh only. Protected company routes require active membership. Administrative services recheck current admin membership within their write transaction.

Refresh cookie: HttpOnly, SameSite=Lax, Path=/auth, Secure in production, no Domain. Session lifetime is seven days absolute, never extended by refresh. Each refresh locks its session, marks the current token used and creates a new hashed token atomically. Reuse revokes the whole session, including its access tokens; clients must serialize refresh across tabs. Retain used hashes until session expiry for replay detection. Revoked/expired session or membership blocks refresh and authenticated requests. Current-session logout uses sid; logout-all revokes all sessions for that user. Both clear the cookie. Authentication responses use Cache-Control: no-store.

Require exact configured frontend Origin on cookie-authenticated refresh and logout operations; reject missing/null/foreign origins. Credentialed CORS allows that origin only. JSON requests have a bounded 256KB body and reject unknown DTO properties. Login redirects are fixed; no returnTo/open redirects. Never log codes, cookies, tokens or raw database errors. Configure at least a 32-byte random JWT secret. Production configuration requires HTTPS frontend/callback URLs. The API trusts no proxy headers by default. Per-process IP rate limits bound public auth requests; a shared gateway limiter is required before multi-instance deployment.

## Tenant and lifecycle rules

Member administration is serialized per company and cannot revoke its last active admin. Revoking a member revokes that user's sessions atomically. Invite operations require current admin role and same-company scope; public verification returns only invited email and role, never the token hash. Invite lifetime is seven days; creation returns a link once for manual sharing. Repeated acceptance and expired/revoked invitations fail.

DELETE party means archive. Default lists hide archived parties; existing biltys may retain unchanged archived references, issue, edit and print. Creating a bilty or changing a reference to an archived party fails. Cross-company and wrong-kind references always fail. Party kind cannot change. Saved party edits never rewrite bilty snapshots.

Bilty edits use PUT full replacement, never PATCH. Request {expectedVersion, data, reason}; every BiltyData field and nested field must be present, using null/empty strings/arrays where appropriate. Create accepts {data} with draft defaults. Issue accepts {expectedVersion}; cancel accepts {expectedVersion, reason}. Stale mutation returns 409; invalid body 400; missing authentication 401; denied membership/admin 403; absent/cross-company resources 404. Existing issued retry semantics remain idempotent. History and print projection are authenticated; print returns JSON, not a PDF. Lists use bounded limit (1–100) and offset (0–100000) with stable ordering; this slice does not promise cursor pagination.

## HTTP routes

- Public: GET /health; GET /auth/google?invite=...; GET /auth/google/callback; GET /invites/verify/:token; POST /auth/refresh (cookie + Origin).
- Authenticated: GET /auth/me; POST /auth/onboard; POST /auth/logout; POST /auth/logout-all (logout also requires Origin).
- Active member: GET /company; POST/GET /parties; GET/PATCH/DELETE /parties/:id; POST/GET /biltys; GET/PUT /biltys/:id; POST /biltys/:id/issue; POST /biltys/:id/cancel; GET /biltys/:id/history; GET /biltys/:id/print.
- Admin: PATCH /company; GET /company/members; DELETE /company/members/:id (user ID); POST/GET /invites; DELETE /invites/:id.

## Verification and runtime

Docker PostgreSQL remains the default. pnpm test:docker creates an isolated database; integration files run serially because each resets its schema. Test foundation-data migration preservation, OAuth state replay/browser binding/nonce/verified email, signup/onboarding races, invitation races and tenant mismatch, refresh replay/concurrency/expiry, immediate session/member revocation, last-admin protection, archived party references, full PUT validation, stale versions and authenticated HTTP tenant isolation. No real Google account or dev database is used by automated tests.

Docker Compose runs postgres, an explicit migration job and the API. Startup never synchronizes or implicitly migrates schema. Runtime settings: DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, FRONTEND_URL, JWT_SECRET, NODE_ENV, PORT. See .env.example and README for commands. Production deployment, frontend login screens and live Google consent verification remain operational follow-ups.
