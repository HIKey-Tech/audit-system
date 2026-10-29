# IAMS UAT Script (corrected, 9 Oct 2026)

Corrected from `IAMS-UAT-Script.docx` after a full dry run. Changes are marked **[changed]** or **[new]**.

## Before you start

1. Start from a clean database so lists and alerts only show UAT data: create an empty database (or `npx prisma migrate reset --force` on a dev DB) then `npx prisma migrate deploy`, `npx prisma db seed`, `npm run seed:role-permissions`, `npx ts-node scripts/seed-compliance-controls.ts`. **[new]** (the dev DB holds 28 Sep demo data and dry-run data.)
2. In the environment's `.env` set `RATE_LIMIT_MAX_REQUESTS=600` or higher and either real SMTP settings or leave SMTP empty (email then fails fast; in-app alerts are unaffected). **[new]**
3. Use one browser profile per user, or sign out with the icon at the bottom of the sidebar. After each page loads, wait about 3 seconds before the first click. **[new]**
4. Every approver saves a signature once: Profile → Signature → Draw → Use signature. Do this for Adaeze, Ibrahim and Fatima.
5. Have ready: a small PDF (evidence), any file (attachment).

| Short name | Email | Password |
|---|---|---|
| SA | superadmin@gbb.gov.ng | Bello@123456! |
| MANAGER | adaeze@gbb.gov.ng | Adaeze@123456! |
| LEAD | tunde@gbb.gov.ng | Tunde@123456! |
| STAFF | emeka@gbb.gov.ng | Emeka@123456! |
| AUDITEE | chisom@gbb.gov.ng | Chisom@123456! |
| DIRECTOR | ibrahim@gbb.gov.ng | Ibrahim@123456! |
| CAE | fatima@gbb.gov.ng | Fatima@123456! |

The seed also creates seven look-alike accounts (`superadmin2@…`, `adaeze2@…` and so on); ignore them. **[new]**

---

## PART 1: Full audit lifecycle (Financial audit, 2 controls)

1. **MANAGER: set up the audit scope**
   1. Audit Universe → New Entity: Name `Treasury Operations`, Category Department, Owner Chisom Okafor, Frequency Annual → Create entity.
   2. Risk Register → Categories tab → ✅ five categories are already seeded, including `Financial Risk`. Create one more to show how: New category `Treasury Risk` → save. **[changed]**
   3. Register tab → New Risk: Title `Unauthorised payment release`, **Description: any text [new]**, Linked Universe Entity Treasury Operations, Category Financial Risk, Owner Ibrahim Musa, Likelihood 4, Impact 5 → Add to register. ✅ Score 20 (Critical). (The owner list is searchable.)
2. **MANAGER: audit programme**
   1. Audit Programme → New Programme: Title `FY 2026 Financial Audit Programme`, Year 2026, **Audit type Financial** → Create programme.
   2. Open it → Add plan: Auditable entity Treasury Operations, Priority High, dates 2026-10-08 to 2026-11-20 → Add item.
   3. Submit for approval. ✅ Status Submitted.
3. **CAE:** open the programme → Approve & Sign → Approve & Sign. ✅ Status Approved; the approval chain shows "signed"; the signed PDF downloads.
4. **MANAGER: create the engagement**
   1. Engagements → Start audit → From plan item → pick the programme and item → Next. **Title, dates and priority are now prefilled [changed]**; confirm Title `Treasury Operations Financial Audit 2026`.
   2. Lead Tunde Bakare; Audit manager Adaeze Okonkwo; Auditee Chisom Okafor; Supporting auditors: Add Emeka Eze; start 2026-10-08, end 2026-11-20, SLA 2026-11-30 → Next.
   3. Checklist controls: click the trash icon on the **last** control so two remain → Create engagement → Save & review later. ✅ Status Planned.
5. **LEAD: start fieldwork, request evidence, test controls**
   1. Engagements → open it → "What's next" card → Start fieldwork. ✅ In progress.
   2. Evidence Requests tab → New request: `Bank reconciliations for September 2026` → Send request.
   3. Evidence tab → drop or choose a small file. ✅ It appears in the list and downloads. **[moved here from Part 4: only works while the engagement is in progress]**
   4. Checklists tab: first control → set Failed, add a note; second control → Passed. ✅ "What's next" updates straight away.
   5. On the failed control click **Raise finding**. The form opens with Category Financial, Severity Medium and the source control already selected. Set Title `Payments released without independent approval`, Severity High, fill Description / Root cause / Risk implication / Recommendation, Auditee Chisom Okafor, Due date 2026-12-15 → Raise finding. ✅ The failed control now shows "Finding raised" instead of the button.
   6. Working Papers tab → New working paper: Title `WP-01 Payment approval testing`, fill every required section → Submit for review.
6. **MANAGER: link an asset (do this now, while the engagement is open) [moved from Part 3]**
   1. System (expand) → Assets → New asset: Tag `AST-001`, Name `Treasury Payment System`, Type Application, Status Active, Owner Chisom Okafor → Create asset.
   2. Engagement → Assets tab → Link asset → search AST-001 → Link asset. ✅ Linked.
7. **AUDITEE: provide evidence (and check what you cannot see)**
   1. Home → "Documents requested from you" → open it → Upload a PDF. ✅ Your own upload can be opened afterwards.
   2. ✅ Open the engagement: Checklists, Working Papers, Evidence and Review tabs are greyed out (padlock). Findings shows nothing yet; the bell has no alert for the new finding.
8. **LEAD: accept evidence** → Evidence Requests tab → Accept.
9. **MANAGER: review the working paper (rejection test first)**
   1. Working Papers tab → Reject → reason `Sample size not stated` → Reject. ✅ The row shows the reason in red.
   2. LEAD: same tab → Submit again. (Only the author sees Submit.)
   3. MANAGER: Approve & Sign → Approve & Sign.
   4. ✅ Refresh: the engagement moves to Quality Assurance on its own.
   5. Side check: LEAD does **not** see Approve & Sign on their own paper. **[changed: hidden for the author]**
10. **LEAD: generate and submit the review** → Review tab → keep the defaults → Generate review → Submit for approval.
11. **Three-level approval**
    1. MANAGER (Level 1): Review tab → Approve & Sign → Approve & Sign.
    2. DIRECTOR (Level 2): Workflow → Review/Approval → Pending inbox → the review → Approve & Sign.
    3. CAE (Level 3): same inbox → Approve & Sign.
    4. CAE: open the engagement → Review tab → Issue review. ✅ Status Review Issued; **download the PDF (now works for the CAE [changed])**.
12. **AUDITEE: respond to the finding**
    1. ✅ Bell shows "Audit findings assigned". Findings → open the finding.
    2. Follow-up card: Management response `Dual approval will be enforced from 1 Nov` → Submit response.
    3. Remediation evidence: choose a file → Upload evidence.
13. **LEAD: verify and request closure**
    1. Open the finding → Follow-up card → Verified → Notes → Save verification.
    2. Request closure.
14. **MANAGER: approve closure**
    1. Workflow → Review/Approval → Pending inbox → Finding closure → Approve & Sign.
    2. ✅ Finding Closed, engagement shows Engagement Completed.
    3. ✅ DIRECTOR's bell has "Risk reassessment suggested" (sent when the lead verified the finding; allow up to a minute).

---

## PART 2: Workflow tests

A. **Programme rejection and resubmit**
   1. MANAGER: create `FY 2026 Compliance Programme` (type Compliance) with one plan item (Dynafin ERP) → Submit for approval.
   2. CAE: open it → Reject → reason → Reject programme. ✅ The reason shows on the programme.
   3. MANAGER: open it → Submit for approval again. ✅ Status Submitted; the chain no longer shows "rejected".
   4. CAE: Approve & Sign.

B. **Ad-hoc request with sign-off**
   1. STAFF: Workflow → Requests → New request: Title `Approve Q4 audit memo`; add recipients Tunde Bakare then Adaeze Okonkwo; attach a PDF → Create request.
   2. LEAD: Requests → To action → open it → Approve.
   3. MANAGER: open it → Sign → type `Adaeze Okonkwo` → Sign now.
   4. ✅ Request completed; Signed documents card has a Download.

C. **Staff assignment: do this straight after Part 1 step 4, while the engagement is still open and before closure [changed]**
   1. MANAGER: engagement Overview → Team → Manage → Remove Emeka → **Remove** in the confirmation → search Emeka → Assign Staff. Only audit staff are listed. On a Closed engagement the Manage button is hidden.

D. **Notifications:** any user: click the bell → View all; Mark all read. ✅ "Marked N notifications as read".

---

## PART 3: Assets
AUDITEE: Assets → open AST-001 → Attest → status Confirmed → Submit attestation. ✅ Appears under the Attestations tab with a green "Confirmed" badge. (Creating and linking the asset is in Part 1, step 6.)

## PART 4: Documents
- LEAD: System → Documents → Upload Document → pick a file. ✅ Only your own files are listed. (Engagement evidence upload is in Part 1, step 5.)
- SA only: upload a file, then ✅ the Documents list shows the delete icon for SA (the LEAD's list does not).

## PART 5: Settings and users (SA, show only)
- System → Settings: tabs Role Management (click Permissions on a role), Audit Customization (Approval Matrix, Lifecycle Gates, SLA Rules), System Configuration.
- System → Users: view the list, open a user. ✅ Fourteen seeded users (seven plus seven look-alikes). **[changed]**

## PART 6: System audit toolkit (short)
- LEAD: System Audit → Access reviews → IAMS accounts → Run now (opens automatically) → Accounts tab → select all → Appropriate. **A justification box appears when privileged or SoD-conflicted accounts are selected; type a reason [changed]** → Exceptions tab → select all → Confirm → Sign off review (**type a note [new]**).
- LEAD: Data analytics → New analysis: Analysis `Backup & recovery verification`, System `DB01`, export file `docs/system-audit-samples/03-backup-jobs.csv`, Date format Day first → Run analysis. ✅ Exceptions appear.
- LEAD: Security testing → Plan test (any title, scope, dates, **and Provider / team [new]**) → Plan test.
- DIRECTOR: open that test → Authorise test → **type a note [new]** → Authorise. ✅ Status Authorised.
- SA: plan a test, then open it. ✅ Authorise test is greyed out with the message "You planned this test, so someone else must authorise it". **[changed]**

## PART 7: Oversight and audit trail
- CAE: System → Analytics → Committee pack (PDF).
- CAE: System → Audit Logs → search `checklist` and click **Audit Checklist Update** (or `remove` → Workflow Assignment Remove). ✅ The drawer shows IP, user agent and a **What changed** table with Before and After. **[changed]**
- CAE: in the same browser open `<your-site>/api/proxy/logs/verify-chain`. ✅ Says "Audit log chain intact".

## If something looks different
- Levels 2 and 3 of the review can only be approved from Review/Approval → Pending inbox, not from the Review tab.
- The sidebar groups System and Audit Modules start collapsed; click to expand.
- Statuses are renamed in the UI: Under review = Quality Assurance, Reported = Review Issued.
- Email is not sent unless SMTP is configured; in-app notifications are unaffected.
