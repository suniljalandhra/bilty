# Digital Bilty / GR Platform — V1 PRD

Updated 21 September 2026 following the repository/prototype review and two supplied Wing Logistics paper biltys. This is the canonical product specification. The copy under the Claude Design export's uploads directory is a synchronized reference.

## Purpose and users

Multi-tenant software for small and midsize Indian transport companies to replace paper bilty/lorry receipt books. Admins manage company branding and employees; Admins and Employees create, issue, edit, print and share their company's biltys. V1 targets partner testing, not an assertion of regulatory compliance.

## Product scope versus implementation status

The complete V1 includes Google OAuth, self-service and assisted company onboarding, invitations, company settings, parties, bilty lifecycle, branded A4/80mm output and WhatsApp sharing. The first implementation slice delivers domain logic and PostgreSQL persistence through a NestJS module. It does not yet expose HTTP endpoints or implement OAuth, frontend screens, PDF generation, public share links or uploads. See README for executable commands and verification.

## Data and entry requirements

- A bilty has **zero or more e-way bill references**. Numbers are strings, normalized by trimming surrounding whitespace, exactly 12 digits, and unique within that bilty. This checks format only, not government validity. Blank/duplicate rows must be corrected or removed; no PDF/image upload is implied.
- A bilty has **zero or more invoices**, each with number, optional invoice date and optional declared value. Invoice numbers must be unique within the bilty (case-insensitive). There is no assumed one-to-one invoice/e-way mapping.
- Consignor and consignee each carry a saved-party reference and/or manually entered snapshot. Validate every referenced party belongs to the company and matches its role. Keep names, addresses, GSTINs and phones in the document snapshot.
- Route, goods description, actual weight with unit, separate optional chargeable weight, optional volume in CBM, package count, packing type, door/godown delivery, vehicle and driver details, and remarks are represented explicitly.
- Freight type is paid, to-pay or billed. Charges comprise freight, loading, unloading, statistical, express and other charges. Grand total is derived and never client-authoritative. Store money as nonnegative integer **paise**; each value and the total are at most 99,999,999,999 paise. Reject negatives, fractions of a paise, NaN and overflow. API-facing dates are ISO strings and measurements are decimal strings.
- Optional insurance declaration records insured/not-insured/unspecified, insurer, policy, date, insured amount and risk. Do not infer insurance amount from invoice value.
- Company print profile covers name, address, GSTIN, PAN, contacts, logo, colours, bank details, jurisdiction, carriage terms and demurrage terms. These are company-configured text, not hard-coded terms copied from another carrier.
  See `fields.md` for exact domain names and validation.

## Lifecycle and numbering

1. **Draft:** saves partial details, has UUID and version but no permanent number. A draft may have missing issuance fields, but any supplied money/reference/measurement must be valid.
2. **Issue:** server validates both party names, origin, destination, goods description, positive actual weight, freight type, freight amount (zero allowed) and vehicle number. Allocate a company-prefixed number atomically in the same transaction as status, snapshots and audit. Company/number is unique. Failed issuance consumes no number. A retry on an already-issued record returns that record without allocating again.
3. **Edit:** requires the current version. Draft edits remain drafts. Issued edits must pass issuance validation and include a reason. Preserve the number and issued company snapshot; record every changed document field, including nested party details and reference collections. Set EDITED and editedAt on a material issued edit. A no-op does not create history or increment version.
4. **Cancel:** permitted to either company role, requires current version and a reason. Preserve number, snapshots and audit. Cancelled is terminal: no edits, restoration or reissue. A future duplicate-to-new-draft action may copy document contents while resetting identity; it must never change the cancelled record.
5. Concurrency: reject stale writes instead of silently overwriting. Each successful material transition increments version. Record createdAt, issuedAt, editedAt and cancelledAt separately using UTC timestamps; display locally.

## Tenancy and security

Every operation verifies an active membership and scopes document access by company. Never trust a caller-provided role or raw request-body company ID as authentication. Saved party references must be same-company. E-way/invoice references belong to the aggregate and have no independent cross-tenant routes. Audit events carry company, bilty, actor, time, action, reason and before/after values, and are written transactionally. No audit update/delete operation is exposed by the application.

Before HTTP endpoints are enabled: verified Google identity, access/refresh handling, rotated and revocable refresh sessions, membership revocation, DTO validation and authorization guards are mandatory. Invitations must use cryptographically random tokens stored hashed, expiry, single use, revocation and an exact normalized invited-email match. Company roles do not grant platform-admin privileges. Assisted onboarding needs a separate trusted administrative path.

## Printing and sharing

A4 and 80mm outputs must use the same derived totals, amount-in-words, weights and reference arrays. Draft and cancelled labels must be visible; issued edits show EDITED. Preserve company/party document snapshots on reprint. Include copy label (consignor/consignee/driver/office), signatures and configured terms. Handle long addresses and many references with wrapping or continuation pages; never clip them. Do not claim “terms overleaf” unless a terms page is generated.

WhatsApp handoff must disclose whether it shares text or an expiring PDF link. The production share-link authorization, expiry and revocation design is a later slice; the prototype's simulated link is not production behavior.

## Acceptance criteria

- One bilty can hold three or more e-way numbers and multiple invoices without data loss.
- Required-field checks cannot be bypassed by opening a previously saved draft.
- Concurrent issuance cannot duplicate numbers; retrying issuance cannot consume another number.
- Address-only, unit-only and reference-only issued edits are audited and marked EDITED.
- Company A cannot read/write Company B biltys or link its parties; revoked users lose access.
- Stale edits fail; failed writes leave number, document and audit unchanged.
- Grand total and words agree, including paise and extra charges, across both print layouts.
- Changing company settings/address-book entries does not rewrite an issued document.

## Deferred scope and open product choices

Branches, offline support, accounting integration, GPS, multi-company membership, e-way government integration and formal amendment/reissue linking remain outside V1. E-way PDF/image uploads and per-invoice/e-way mapping require a separate product decision. Backend rules in this PRD supersede the older single-reference model and deferred numbering-concurrency language.
