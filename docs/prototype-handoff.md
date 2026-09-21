# Claude Design handoff — 21 September 2026

The HTML export is an interaction/layout reference, not production Next.js code. The corrected canonical PRD is `docs/prd.md` in the backend repo. Its synchronized copy is `uploads/bilty-platform-prd-v1.md` in the design folder. Prototype changes below are still pending; backend logic must not copy the export's handlers unchanged.

## Required design updates

- Keep repeatable e-way rows; add repeatable invoices with optional date and value.
- Separate actual weight, chargeable weight and CBM. Never render actual as chargeable by default.
- Align charge entry with freight/loading/unloading/statistical/express/other. Display grand total and amount-in-words from the same calculation, including paise, in A4 and thermal layouts.
- Saving a partial draft is allowed. Issuing must validate persisted contents on the server; navigating from the list must not bypass errors.
- For issued edits replace “Save Draft” with “Save changes”, collect reason and use a version conflict state. All document fields must participate in audit and EDITED detection.
- Cancelled records remain cancelled and retain numbers. Remove “Restore to draft”; later duplication creates a new identity.
- Use issued company/party snapshots for historic previews. Changing branding or party details must not change old documents.
- Print DRAFT/CANCELLED/EDITED correctly in both layouts. Add continuation behavior for long content and many references.
- Replace inherited carrier terms/demurrage with company configuration; no “read overleaf” without a terms page.
- Add mobile layout breakpoints, associated form labels, dialog focus management, and browser-leave protection; these were not certified in the review.

## Explicit simulations

Google sign-in, employee invitations, PDF generation, copied messages and share links are simulations. Client role switching is a demo control, not security. Preview data is in memory and resets on reload. Production uses authenticated API access and durable persistence.
