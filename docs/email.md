# Authentication email delivery

Bilty sends signup verification, verification resends and password-reset links through Resend's HTTPS API. The API key and sender configuration are backend-only. No Resend MCP connection is required by the app.

## Configure Resend

1. Add and verify a domain you control in Resend. `mail.winggroup.org` is the proposed sending subdomain; **use the exact domain shown as verified in your account**. Root-domain verification is not proof that this subdomain is verified. Preserve the existing website and mail DNS records.
2. Create a Sending access API key restricted to that domain.
3. Set these values privately in the root `.env` for local Docker, or your production secret manager:

```dotenv
EMAIL_PROVIDER=resend
RESEND_API_KEY=your-private-api-key
EMAIL_FROM=noreply@mail.winggroup.org
```

`EMAIL_FROM` must be a plain email address, without a display name. Bilty adds the `Bilty` display name. If the verified domain is `winggroup.org`, use an address on that domain instead. Do not commit the API key, paste it in chat, or put it in a `NEXT_PUBLIC_` variable.

`FRONTEND_URL` determines the links. Use the publicly reachable HTTPS frontend origin for real recipients; localhost links only work on the recipient's own machine. Restart the API after configuration changes (`pnpm docker:app` for Compose). Apply the `AuthEmailLimits1790000000004` migration before serving requests (`pnpm docker:migrate`, or `pnpm db:migrate` with an exported DATABASE_URL).

Production requires Resend, a nonempty API key and a valid sender address. Validation checks configuration presence, not provider approval. Development and tests default to `EMAIL_PROVIDER=console`, which prints links locally without sending emails. Production never permits that mode. Disable open/click tracking in Resend for authentication mail to avoid rewriting bearer links.

## Limits and failures

- Verification links expire after 24 hours; reset links after one hour. Tokens remain hashed in the database and single-use. Password reset revokes existing sessions.
- Signup and verification resend share a limit of three requests per normalized email per hour. Reset requests have a separate three-per-hour limit. Missing/existing accounts consume the same allowance; throttled requests return the same generic response and leave the current link intact.
- Limits live in PostgreSQL, apply across API instances, and use an HMAC of the email and purpose instead of storing addresses. Rotating JWT_SECRET also resets these identities. Expired limit records are removed on subsequent requests.
- Delivery happens after the token transaction commits. Each request has a 10-second timeout and a token-derived, non-secret idempotency key. Resend acceptance is not confirmation of inbox delivery.
- There is no background queue or automatic retry in this implementation. On rejection, timeout or malformed provider response, the backend logs a generic failure without addresses, tokens, credentials or provider bodies. Public responses stay generic to avoid revealing account existence. Users can request another link within the limit, or wait until the hourly window resets. Check the provider dashboard for delivery failures, quota exhaustion and bounces.
- An interrupted API process between commit and send can leave an unsent link; requesting a new link is the recovery path. Monitor delivery errors before enabling public signup.

## Verification

`pnpm check` covers configuration, payloads and redacted provider failures without contacting Resend. `pnpm test:docker` covers migrations, committed token delivery, recovery after a provider failure, concurrent limits, expiry and token preservation in a disposable database.

Before launch, use a controlled account to check signup, inbox/spam delivery, verification, reset, old-password rejection and session revocation with real credentials. No live email was sent as part of the automated tests.

API reference: https://resend.com/docs/api-reference/emails/send-email
