# Dynafin ↔ IAMS — data contract

**Audience:** the Dynafin development team and GBB IT.
**Status:** proposed — IAMS's driver is built and waiting. Dynafin's real API will differ in detail; this
document says what IAMS needs so the two can be matched with the smallest possible change.

## 1. What this is for

GBB's *IAMS Reports Requirements* asks IAMS to analyse Dynafin finance data for Internal Audit:
high-value transactions (> ₦5m), high-value expenditure in nine categories (> ₦10m), duplicate postings,
and staff-advance retirement (72 hours). Phase 1 covers those three analyses. Further reports are listed in §7.

## 2. Ground rules

| Rule | Detail |
|---|---|
| **Read-only** | IAMS only ever issues `GET` requests. It cannot create, change, approve or delete anything in Dynafin. |
| **Format** | JSON over HTTPS. A bare array, or an envelope `{ "items": [...] }` (also accepted: `data`, `results`, `records`). |
| **Authentication** | One of: none (private network only), API key in a header (default `X-Api-Key`), or `Authorization: Bearer <token>`. To be agreed. |
| **TLS** | A private CA is supported (`DYNAFIN_CA_CERT_PATH`) if Dynafin uses an internal certificate. |
| **Dates** | ISO 8601, UTC (`2026-11-13T10:00:00Z`). A bare date (`2026-11-13`) is read as midnight UTC. |
| **Money** | A JSON number in Naira (`5000000.01`), or a string such as `"5,000,000.01"` / `"₦5,000,000.01"`. No comma-as-decimal formats (`1.234,50`) — IAMS refuses these rather than risk a 100× misreading. Amounts are taken as absolute values. |
| **Time window** | `from` and `to` query parameters, inclusive. |

## 3. Endpoints IAMS will call

Paths are placeholders (`DYNAFIN_ENDPOINTS` in `dynafin.client.ts`); IAMS will use whatever Dynafin publishes.

| Purpose | Proposed request | Returns |
|---|---|---|
| Ledger transactions | `GET /transactions?from=<iso>&to=<iso>` | list of **Transaction** |
| Staff advances | `GET /staff-advances?from=<iso>&to=<iso>` | list of **Staff advance** |
| Health check | `GET /health` | any `2xx` |

**Pagination:** not yet defined. Dynafin should state how large result sets are paged (page/offset/cursor); IAMS
will add it to the driver. Until then IAMS expects the full window in one response.

## 4. Transaction

One individual ledger posting or payment. **Thresholds apply to each transaction on its own — IAMS never adds
transactions together.**

| Field | Required | Meaning | Names IAMS already recognises |
|---|:-:|---|---|
| `reference` | ✅ | Unique posting / journal / voucher reference | reference, ref, journalNumber, voucherNumber, postingReference, transactionId, id |
| `postingDate` | ✅ | When it was posted | postingDate, date, transactionDate, postedAt, valueDate |
| `amount` | ✅ | Value of the transaction | amount, value, transactionAmount, netAmount, debit, total |
| `currency` | | Defaults to `NGN` | currency, currencyCode |
| `accountCode` | ✔ | GL account code | accountCode, account, glCode, ledgerCode |
| `accountName` | ✔ | GL account name | accountName, accountDescription, glName |
| `expenseCategory` | ✔ | Dynafin's expense classification, if it has one | expenseCategory, category, expenditureCategory, expenseType |
| `description` | ✔ | Narration | description, narration, narrative, remarks |
| `payee` | ✔ | Vendor / payee / beneficiary | payee, vendor, vendorName, supplier, beneficiary |
| `department` | ✔ | Department / cost centre | department, costCentre, costCenter |
| `postedBy` | ✔ | User who posted it | postedBy, postingUser, createdBy, enteredBy |
| `approvedBy` | ✔ | User who approved it | approvedBy, approver, authorisedBy |
| `supportingRef` | ✔ | PO / contract / voucher reference | supportingRef, poNumber, purchaseOrder, documentReference |
| `invoiceNumber` | ✔ | Vendor invoice number | invoiceNumber, invoiceNo, invoice |
| `isReversal` | ✔ | `true` if this posting reverses another | isReversal, reversal, reversed |

✅ = IAMS drops a record without it (and logs how many were dropped). ✔ = optional, but **the more of these Dynafin
supplies, the more IAMS can check** — for example, it only flags "no approver" if Dynafin supplies approvers at all.
`expenseCategory` (or account codes) is what lets IAMS recognise the nine expenditure categories in §2 of the requirements.

## 5. Staff advance

| Field | Required | Meaning | Names IAMS already recognises |
|---|:-:|---|---|
| `advanceId` | ✅ | Advance reference | advanceId, advanceNumber, advanceNo, reference |
| `employee` | ✅ | Employee name | employee, employeeName, staffName |
| `employeeId` | ✔ | Staff / payroll number (used to match repeat advances reliably) | employeeId, staffId, staffNumber |
| `issuedAt` | ✅ | When the advance was issued | issuedAt, issueDate, dateIssued, advanceDate |
| `amount` | ✅ | Amount advanced | amount, advanceAmount |
| `retiredAmount` | ✔ | Total retired so far (default 0) | retiredAmount, amountRetired |
| `refundedAmount` | ✔ | Total refunded so far (default 0) | refundedAmount, amountRefunded |
| `retiredAt` | ✔ | Date of the last retirement | retiredAt, retirementDate |
| `purpose` | ✔ | What it was for | purpose, description, reason |

**Important:** the list must contain advances **issued in the window _or still outstanding_**, however old. An
advance issued three weeks ago and never retired is exactly what the report exists to find. (IAMS asks for a
minimum 90-day look-back for this reason.)

## 6. Manual upload — works today, no API needed

Until the API exists, an auditor can export the same data from Dynafin as **CSV or Excel** and upload it under
**System audit → Data analytics → New analysis** (choose *High-value transactions*, *Duplicate & unusual postings*
or *Staff advances*). IAMS matches columns by header name (the "names IAMS already recognises" above) and lets the
auditor fix the mapping. The analysis, exceptions, review, sign-off and export are identical to a live run.

## 7. Thresholds and rules (from the requirements)

* High-value transaction: **strictly above ₦5,000,000**. High-value expenditure: **strictly above ₦10,000,000** in the nine
  named categories. Exactly equal amounts do **not** qualify. Individual transactions only — never aggregated.
* Both thresholds are configurable by authorised users (Settings → Config, keys `dynafin.high_value_threshold` and
  `dynafin.high_value_expenditure_threshold`); every change is recorded in the audit trail with old and new value.
* Staff advances must be retired within **72 hours**.
* The daily duplicate-posting check runs automatically once Dynafin is connected, and notifies Internal Audit administrators.

## 8. Not yet covered — please plan for these

These reports in the requirements need more data than Phase 1 asks for. Telling IAMS early what Dynafin can expose lets
the next phase be built to match:

| Reports | Data needed from Dynafin |
|---|---|
| Debtors / creditors ageing (1.3, 1.4) | Open receivable / payable items: customer or vendor, invoice, amount, due date |
| PPE register (1.5) | Asset register: tag, description, cost, acquisition date, accumulated depreciation, location, additions / disposals / transfers; GL balances to reconcile |
| Income statement, cost of sales, expenditure analysis & variance (1.1, 1.2, 1.11, 1.12) | Account balances / movements per period by account, department, cost centre, project; approved budgets |
| Revenue reconciliation, billing, revenue analysis (5.1–5.4) | Invoices raised, receipts / cash collected, receivables, revenue recognised, service and anniversary dates |
| Annual statement audit support (1.15) | Year-end schedules, ledger reconciliations, unresolved differences |

Project Plus (purchase orders, project status, billing) will additionally need endpoints for **purchase orders, projects and
invoices** — today the Project Plus connection only returns customers and document types. Project Plus already carries
`finClientId` / `finVendorId` / `finCustomerId`, which can serve as the join key to Dynafin.

## 9. What changes in IAMS when Dynafin is ready

1. `.env`: `DYNAFIN_ENABLED=true`, `DYNAFIN_DRIVER=http`, `DYNAFIN_BASE_URL`, and the `DYNAFIN_AUTH_*` values.
2. `src/modules/integration/dynafin/service/client/dynafin.client.ts` — set the real paths in `DYNAFIN_ENDPOINTS`.
3. `src/modules/integration/dynafin/utility/dynafin.utility.ts` — add any field names not already recognised (§4–5), and
   pagination if needed.

No database migration, no new permissions, no change to the analyses, review workflow or reports.

Before then, `DYNAFIN_DRIVER=fixture` (never allowed in production) serves clearly-labelled sample data so the analyses
can be demonstrated to stakeholders.
