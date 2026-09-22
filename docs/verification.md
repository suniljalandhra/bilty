# Local V1 verification

Verified from the Bilty repository on 22 September 2026.

| Check                              | Result                                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                       | Passed formatting, all workspace typechecks, 26 API/domain/PDF tests, 6 frontend tests and both production builds |
| `pnpm test:docker`                 | 36 PostgreSQL integration tests passed against a disposable database                                              |
| `pnpm test:e2e`                    | 5 Chromium browser journeys passed against a disposable database and the real API/Next app                        |
| `pnpm docker:app`                  | API and standalone Next images built; PostgreSQL/API/web healthy                                                  |
| `GET http://localhost:3000/health` | HTTP 200, status ok, googleConfigured false                                                                       |
| `GET http://localhost:3001/login`  | HTTP 200; app opened in the browser                                                                               |
| Migrations                         | BiltyFoundation1790000000000, AuthTables1790000000001, PdfShares1790000000002 applied                             |

Browser journeys cover company setup, three e-way references and two invoices on one bilty, issue/edit/audit/cancel, PDF download, share revocation, mobile layout, contacts, employee invitation acceptance and revocation, Back/Forward/Escape handling, concurrent tab refresh and cross-tab logout. Representative A4, thermal and Devanagari PDFs were rendered and visually inspected. Desktop and mobile UI screenshots were inspected. Integration tests cover migration preservation, tenant isolation, numbering/version races, refresh reuse, last-admin races and cancellation/share races.

The automated Google provider is injected only by test code; it is excluded from the API production build. Live Google consent remains unverified until the operator configures GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the ignored `.env` and registers the callback URI. The local `.env` contains a generated JWT secret; credentials are not committed. Localhost share links require public hosting before off-machine recipients can use them.

The user-selected frontend is under `apps/web`. The previous scaffold and its lockfile are preserved beside the repository in `frontend-scaffold-backup-2026-09-22-ejin42ja/`. Existing development database data was retained; test runners cleaned up only their own disposable resources. Changes are left in the working tree; no new commit or remote deployment was made in this completion pass.

Supported browser verification currently covers Chromium. Navigation API provides Back/Forward warnings; older browsers without it retain link and document-unload warnings. PDFs and UI support English and Devanagari text; no government e-way validation or regulatory certification is implied.
