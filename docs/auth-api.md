# Auth and HTTP integration

## Google and company setup

1. Create a Google OAuth **web application** client with redirect URI `http://localhost:3000/auth/google/callback` for local development. Configure consent/test users as appropriate. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET privately in .env.
2. Generate JWT_SECRET using `openssl rand -hex 32`. Set FRONTEND_URL to the exact frontend origin (local default `http://localhost:3001`, no path or trailing slash). Production URLs must use HTTPS with NODE_ENV=production.
3. Navigate the browser to `GET /auth/google`. An invite page can append `?invite=<token>`; the backend binds that invitation to the OAuth state. The callback sets the refresh cookie and redirects to FRONTEND_URL + `/auth/callback` without tokens in the URL.
4. From that frontend origin, POST `/auth/refresh` with `credentials: 'include'`. The response is `{accessToken, expiresIn: 900}`. Keep access tokens in memory and serialize refresh requests across tabs: concurrent reuse intentionally revokes the session.
5. Send `Authorization: Bearer <accessToken>` for authenticated requests. GET `/auth/me` returns user, companyId, role and onboardingRequired. New users POST `/auth/onboard` with `{profile: {name: 'Example Transport'}, numberPrefix: 'EX/'}`. Setup creates one company and its first admin atomically.

A seven-day session has a fixed expiry. Refresh rotates the opaque cookie without extending it. Logout and membership revocation immediately invalidate subsequent requests. A request already authorized and executing may finish. Roles and company access are read from current membership on each request. The final active admin cannot be revoked. V1 does not transfer users between companies; a revoked member can only be reinvited into their original company.

## Endpoints and bodies

All bodies are JSON. Unknown DTO fields are rejected. Body limit: 256KB. Times serialize as ISO timestamps; money is integer paise. Resource UUIDs are strings. Responses never include stored hashes.

| Method/path                 | Access                        | Body/result                                                               |
| --------------------------- | ----------------------------- | ------------------------------------------------------------------------- |
| GET /health                 | Public                        | Database readiness and googleConfigured                                   |
| GET /auth/google            | Public                        | Optional invite query; redirect                                           |
| GET /auth/google/callback   | Public                        | Google code/state; fixed redirect                                         |
| POST /auth/refresh          | Refresh cookie + exact Origin | Access token; rotated cookie                                              |
| GET /auth/me                | Session                       | User + membership + onboardingRequired                                    |
| POST /auth/onboard          | Session without membership    | `{profile, numberPrefix}`                                                 |
| POST /auth/logout           | Session + Origin              | Revoke current session; clear cookie                                      |
| POST /auth/logout-all       | Session + Origin              | Revoke all user's sessions                                                |
| GET /company                | Member                        | `{id, profile, numberPrefix, nextNumber}`; counter is a read-only string  |
| PATCH /company              | Admin                         | Partial `{profile: {...}, numberPrefix}`; unknown profile keys rejected   |
| GET /company/members        | Admin                         | Member list, including revoked members                                    |
| DELETE /company/members/:id | Admin                         | Revoke by user ID                                                         |
| POST /invites               | Admin                         | `{email, role}`; one-time response includes token and frontend invite URL |
| GET /invites                | Admin                         | Latest 100 invitations; no hashes/tokens                                  |
| DELETE /invites/:id         | Admin                         | Revoke invitation                                                         |
| GET /invites/verify/:token  | Public                        | Valid invitation's email and role only                                    |
| POST /parties               | Member                        | `{kind, name, address?, gstin?, phone?}`                                  |
| GET /parties                | Member                        | Active parties; limit/offset                                              |
| GET /parties/:id            | Member                        | Snapshot, kind, archivedAt                                                |
| PATCH /parties/:id          | Member                        | Partial name/address/gstin/phone; kind immutable                          |
| DELETE /parties/:id         | Member                        | Archive, preserve referenced records                                      |
| POST /biltys                | Member                        | `{data}` partial draft                                                    |
| GET /biltys                 | Member                        | limit/offset, q/status/from/to filters; newest first                      |
| GET /biltys/:id             | Member                        | Full BiltyRecord                                                          |
| PUT /biltys/:id             | Member                        | `{expectedVersion, data, reason}` complete replacement                    |
| POST /biltys/:id/issue      | Member                        | `{expectedVersion}`                                                       |
| POST /biltys/:id/cancel     | Member                        | `{expectedVersion, reason}`                                               |
| GET /biltys/:id/history     | Member                        | Full audit events                                                         |
| GET /biltys/:id/print       | Member                        | JSON print projection, not a PDF                                          |

List limit defaults to 50, maximum 100; offset defaults to 0, maximum 100000. Stable ordering is used, but offset pages can shift as records are inserted. The bilty API deliberately has no PATCH route. Start with the fetched `data`, modify intended fields and send every field back; include empty arrays/strings/nulls where appropriate. This preserves multiple e-way/invoice collections and prevents accidental clearing. An issued edit needs a reason; cancellation always needs one. Version conflicts return 409; refetch and reconcile instead of blind retries.

Errors use `{statusCode, message}`: 400 validation, 401 authentication/session, 403 membership/admin/Origin, 404 absent or foreign resource, 409 state/version/uniqueness conflict, 429 rate limit. Failed refresh clears the cookie. OAuth failure clears the cookies and redirects only to FRONTEND_URL/login?error=sign_in_failed. Expired/used/revoked invitations are unavailable. Access is Google-only; manual invitation link sharing replaces email delivery in this slice.

## Nest authentication and authorization

The application registers `AuthGuard implements CanActivate` globally with `useGlobalGuards`. The `@Public()` decorator uses Nest metadata and Reflector to exempt only explicit public endpoints. JWT verification is delegated to TokenService; AuthService also checks the live session and membership. This is a custom Nest guard rather than a Passport strategy. Controllers read the trusted principal through `@Req()`; there is no separate `@CurrentUser()` or `@Roles()` decorator. Administrator and tenant checks remain inside transactional service methods, including last-admin protection. Express middleware is used for headers and rate limiting, not authentication.

## Operational boundaries

Cookies are host-only, HttpOnly, SameSite=Lax, Path=/auth and Secure in production. Frontend/API should be hosted on the same site for these cookies; unrelated sites need a separately reviewed cookie/CSRF strategy. CORS allows the configured frontend origin with credentials. Cookie-based POSTs require that exact Origin. Do not put refresh/access tokens in URLs or logs. Invitation links contain a bearer token and must be treated as private; callback and auth responses use no-store/no-referrer.

The per-process limiter permits 120 auth/public-invite/public-share requests per IP per minute. Proxy headers are not trusted; a gateway and shared limiter are needed for a multi-instance deployment. Expired OAuth states are pruned on new login. Expired sessions/used refresh hashes remain for now; operational retention cleanup can delete expired sessions and cascade their hashes after expiry. No credentials are committed.

Automated tests substitute the external Google provider. The Next.js login, callback and invitation pages are implemented. A real browser consent round trip must still be verified with your configured OAuth client.

## PDFs and controlled sharing

GET /biltys/:id/pdf accepts format=a4 (the default) and copy=consignor|consignee|driver|office; it returns application/pdf in A4 landscape. Thermal rendering is retired; new thermal requests are rejected, and existing thermal share links render their frozen data as A4. POST /biltys/:id/shares accepts {expiresInHours: 1..168, format, copy} and returns {id, url, expiresAt, version}. Only issued biltys can be shared. GET /biltys/:id/shares lists metadata; DELETE /biltys/:id/shares/:shareId revokes. Public GET /shared/:token returns the fixed shared PDF version until expiry/revocation/cancellation. PUBLIC_API_URL controls generated links and must be reachable by recipients. Localhost links are only usable on the same computer until a public deployment is configured.

Company profile logoUrl accepts a validated inline PNG/JPEG up to 200000 encoded characters and 2048px per dimension. The UI accepts files up to 120KB. PDF rendering never fetches remote URLs. Noto fonts are bundled under the SIL Open Font License; English and Devanagari runs are supported.

The local development API can start with blank Google credentials and reports googleConfigured=false from /health; sign-in fails closed with 503 until configured. Production refuses to start without credentials.

Company print profiles accept `biltyLayout`: `classic-grid` (default), `route-focus`, `freight-ledger`, `dispatch-sheet`, or `modern-panels`. Settings affect drafts and future issues. Issued biltys and share links use their frozen company layout, logo and colours. Historic profiles and snapshots without a layout render as Classic Grid.
