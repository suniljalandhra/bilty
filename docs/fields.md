# Bilty field contract

This dictionary describes `BiltyData` in `@bilty/shared-types`. Dates and nullability are explicit; transport DTOs must not expose database-only secrets.

| Field                                                     | Shape / rule                                                                                                                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| consignor, consignee                                      | `PartySnapshot`: optional UUID `partyId`, name, address, GSTIN, phone. Name required at issue. Reference must belong to tenant and role.                         |
| fromLocation, toLocation, goodsDescription, vehicleNumber | Strings, may be empty in drafts; nonempty at issue. Vehicle format is not restricted to one registration pattern.                                                |
| actualWeight, chargeableWeight                            | Null or `{value, unit}`; decimal string > 0, up to three decimal places; kg/quintal/tonne. Actual required at issue. No silent copying to chargeable.            |
| volumeCbm                                                 | Null or positive decimal string, up to three places.                                                                                                             |
| packageCount                                              | Null or positive integer.                                                                                                                                        |
| packingType, remarks, driverName, driverPhone             | Strings; empty allowed.                                                                                                                                          |
| deliveryMode                                              | Null, door or godown.                                                                                                                                            |
| freightType                                               | Null, paid, to-pay or billed; required at issue.                                                                                                                 |
| charges                                                   | `freightPaise` may be null until issue; loadingPaise, unloadingPaise, statisticalPaise, expressPaise, otherPaise default 0. Nonnegative integers; total derived. |
| invoices                                                  | Array of `{number, date: YYYY-MM-DD or null, declaredValuePaise: integer or null}`. At most 200. Numbers unique case-insensitively within document.              |
| ewayBills                                                 | Array of 12-digit strings, at most 200, no within-document duplicates. Leading zeroes preserved.                                                                 |
| gstPayableBy                                              | Null, consignor, consignee or agency. Declaration only; no tax calculation.                                                                                      |
| insurance                                                 | `{status, company, policyNumber, date, amountPaise, risk}`. Status unspecified/not-insured/insured. Insured requires company and policy at issue.                |

Each reference number is at most 100 characters; ordinary text fields at most 2,000 characters, goods/remarks/terms at most 10,000. Money maximum is 99,999,999,999 paise; measurements have at most nine integer digits. Bounds prevent oversized/unrepresentable documents; pagination must still support the permitted limits.

`BiltyRecord` adds UUID identity, companyId, version, status, nullable permanent number, createdAt, updatedAt, issuedAt, editedAt, cancelledAt, isEdited and companySnapshot. `AuditEvent` records action, actor, timestamp, reason and full before/after data. Number/prefix edits are not document edits.

The service accepts an **already-authenticated** `{userId, companyId}` context and verifies active membership in the DB. It must never be wired directly to an unverified HTTP request body. The current slice exports no HTTP controller.
