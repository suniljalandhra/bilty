# Complete local V1 application

The user requested completion of the application after approving the auth review fixes. Deliver the canonical V1 as a locally runnable Docker application. Preserve the existing paper-bilty field model and Claude Design visual direction: warm grey workspace, blue actions, compact sidebar, clear document tables and forms. Real Google login requires operator-supplied OAuth credentials; never add a production authentication bypass.

## User flows

Next.js App Router implements sign-in, OAuth callback, invitation acceptance, first-company setup, bilty list/search/status filters/paging, create/edit/view/issue/cancel, audit history, parties, company settings and employee invitations/revocation. Full forms expose all BiltyData fields, repeatable invoice/e-way rows, independent actual/chargeable weight and CBM, six charge amounts, insurance and copy labels. Currency inputs convert decimal rupees to exact integer paise. Server-calculated totals remain authoritative. Responsive layout and explicit labels/errors/loading/empty states are required. Dirty forms warn on departure; issued edits require reason; stale saves require refetch/reconciliation. Cancelled records are read-only.

## Browser authentication

Use the existing API routes from docs/auth-api.md. NEXT_PUBLIC_API_URL defaults to http://localhost:3000. Backend FRONTEND_URL defaults to http://localhost:3001. Keep JWT in memory, fetch refresh with credentials, serialize refresh calls across tabs using the Web Locks API where available. Access expires in 15 minutes; refresh before expiry and retry a 401 once. Use a cross-tab BroadcastChannel to propagate logout. No sample/demo credentials, no localStorage bearer tokens. The app redirects unauthenticated users to sign-in and onboard-required users to setup.

## Printable documents and sharing

Authenticated GET /biltys/:id/pdf?format=a4|thermal&copy=consignor|consignee|driver|office renders PDF from printData. Include snapshot company profile, party snapshots, references, charges, amount in words, insurance, terms, signature lines and status markers. Both formats paginate/wrap long content. Thermal width is exactly 80mm; A4 is standard. Generate server-side with PDFKit, no headless browser or arbitrary URL fetch. Support a bounded inline PNG/JPEG company logo; remote logo URLs remain visible in the browser but are not fetched by PDF rendering. UI can load a logo file into an inline profile value. Issued snapshots freeze it like other profile fields.

POST /biltys/:id/shares {expiresInHours:1..168,format,copy} creates a private bearer PDF link (32 random bytes; SHA256 stored). Only issued biltys can be shared. Store the exact BiltyRecord/version used when shared, but reject access if the live bilty is cancelled. Links expire, can be revoked by either active company role, and never give API/data access. GET /biltys/:id/shares lists metadata, DELETE /biltys/:id/shares/:shareId revokes, public GET /shared/:token returns PDF with no-store/no-referrer and no internal identifiers in errors. Editing does not silently rewrite previously shared snapshots; UI labels shared version and explains that a new link is needed for edited copies. WhatsApp opens wa.me with explicit text plus expiring PDF link, never sends automatically.

## Runtime and testing

Docker Compose runs postgres, one migration job, API and web. A startup healthcheck verifies both apps. Existing containers/data outside this project remain untouched. Add PDF generation/parse regression tests, share tenancy/expiry/revocation/cancellation tests and browser E2E tests using an isolated test database and test-only injected external Google provider (no bypass in production). E2E exercises signup/company setup, create with multiple refs, issue/edit/cancel, parties and admin features. Validate desktop/mobile UI and render representative A4/80mm PDF pages visually. Document exact run commands and external credentials needed; do not claim deployed or live Google verified without evidence.
