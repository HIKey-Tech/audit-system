# NDPR Data Retention Schedule — IAMS

**Status:** Draft pending GBB Data Protection Officer sign-off.
**Enforcement:** Weekly background job `BG:RETENTION:PURGE:WEEKLY` (Sundays 04:00). Periods are admin-editable in `system_config` key `data_retention`; setting a category to `0` disables purging for it.

## Personal data held by IAMS

| Data | Where | Why it's personal data |
|---|---|---|
| User profiles (name, email, department, job title) | `users` | Direct identifiers |
| IP addresses & user agents | `audit_logs`, `refresh_tokens`, `password_reset_tokens`, `email_logs` | Online identifiers under NDPR |
| E-signature images | `user_signatures`, embedded in signed report artifacts | Biometric-adjacent personal data |
| Notification content addressed to a person | `notifications`, `email_logs` | Linked to an identified user |

## Retention periods (defaults)

| Category | Table(s) | Default | Basis | Disposal |
|---|---|---|---|---|
| Compliance audit trail | `audit_logs` | **7 years** (2555 days) | Federal audit-evidence expectations (ISO 27001 A.8.15; government record-keeping) outweigh minimisation for the trail itself | Hard delete by purge job |
| In-app notifications | `notifications` | **1 year** | Operational value only | Hard delete by purge job |
| Email delivery logs | `email_logs` | **1 year** | Delivery troubleshooting only; holds addresses | Hard delete by purge job |
| Password-reset tokens / email OTPs | `password_reset_tokens`, `mfa_email_otps` | **90 days** | Dead minutes after issuance; kept briefly for incident forensics (hold IPs) | Hard delete by purge job |
| Refresh tokens | `refresh_tokens` | Until expired/revoked | Session security | Already purged hourly (`BG:TOKEN:CLEANUP:HOURLY`) |
| Document versions | `document_versions` | Indefinite by default | Audit-evidence immutability; opt-in prune via `version_retention` | Weekly prune job when enabled |
| Signed report artifacts | report storage | Life of the audit record | Legally significant signed records | Not auto-purged |

## Open items (require GBB DPO / management decision)

1. **Departed-user data.** Users are soft-deleted, never purged, because they are referenced by engagements, approvals, and signed reports that must stay attributable. Recommended path: an **anonymisation** routine (replace name/email with a tombstone label after N years of inactivity) rather than deletion. Needs a DPO-approved period.
2. **Data-subject requests.** NDPR grants access/rectification/erasure rights. Erasure conflicts with audit-trail retention; the standard resolution is the legal-obligation exemption — but the response procedure must be documented by GBB.
3. **Warehouse archive.** `BG:LOG:ARCHIVE:WEEKLY` selects logs older than 90 days for warehouse export but the export is still a TODO. If GBB wants archive-then-purge (shorter live retention), build the `DataWarehouseClient` first, then lower `auditLogDays`.
