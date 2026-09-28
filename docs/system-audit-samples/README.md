# System audit sample extracts

Small, fictional exports for demonstrating each analysis in **System Audit → Data analytics**
(or the Access reviews / Security testing pages). Upload one with **New analysis**; the columns
are recognised automatically. Dates are day-first (Nigerian format).

| File | Analysis | What it demonstrates |
|---|---|---|
| `01-access-listing-dynafin-users.csv` | User access review | SoD conflicts (create + approve payments; vendor master + payment run), dormant, generic, privileged, and unmatched accounts |
| `02-change-log.csv` | Change management review | Unapproved, approved-late, self-approved, untested, and unratified emergency changes |
| `03-backup-jobs.csv` | Backup & recovery verification | Failed jobs, backup gaps, a server with no good backup, overdue and over-RTO restore tests (set the RTO to 120 minutes) |
| `04-incident-log.csv` | Incident management review | Response / resolution SLA breaches, aged open incidents, closure without resolution notes |
| `05-security-events.csv` | Security log anomaly analysis | Brute force, password spraying, off-hours privileged change, cleared audit log |
| `06-configuration-firewall.csv` | Configuration baseline review | Drift against expected values and insecure settings (TLS 1.0, permit any any). Approve the run as the baseline, then upload a later export to see drift detection |
| `07-vulnerability-scan.csv` | Vulnerability scan results | Grouped critical findings and overdue remediation — link it to a security test |
| `08-data-integrity-dynafin-vouchers.csv` | Data integrity checks | Choose **Voucher No** as key and sequence, **Vendor** as mandatory, **Amount** with the ledger control total of 3,925,000 (the duplicated voucher inflates the extract by 480,000), **Posting Date** for September 2026 |
