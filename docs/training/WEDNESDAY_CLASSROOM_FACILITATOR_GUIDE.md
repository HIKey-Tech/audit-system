# Wednesday Live Class: Facilitator Quick-Reference Guide
**Target Time:** 60 Minutes · **Topic:** The Full Audit Lifecycle End-to-End  
**Keep this document open on your phone during the interactive session.**

---

## 👥 Real Colleague Setup: Roles, Permissions & Account Mapping

In your office training, colleagues sit at their own laptops and log in with **their own corporate accounts**.  
Before beginning, ensure each participant has been assigned the appropriate role in **Settings → Users**:

| Classroom Seat / Trainee Role | Recommended System Role | Key Permissions Under the Hood | Hands-On Classroom Mission |
|---|---|---|---|
| **Lead Auditor Trainee** | `audit_lead` | `working_paper:create`, `evidence:request`, `finding:create`, `followup:verify` | Starts fieldwork, tests controls on checklist, raises draft findings, authors and submits working papers, verifies remediation proof. |
| **Audit Manager Trainee** | `audit_manager` | `engagement:create`, `working_paper:approve`, `report:approve`, `finding:close`, `assignment:create` | Initializes engagement from Plan, reviews/rejects/approves working papers, signs Report Level 1 review, approves finding closures. |
| **Supporting Auditor Trainee** | `auditor` | `working_paper:create`, `evidence:upload` | Added to engagement team via Team tab, executes assigned testing procedures, uploads working paper audit evidence. |
| **Auditee Trainee** (Dept Head / Process Owner) | `auditee` (or general employee) | Dynamic Contextual Scoping (granted when named as Auditee or Request Assignee) | Receives automated audit notification email, views outstanding PBC requests, uploads requested operational documents, submits management response after report issuance. |
| **Director Trainee** (Oversight) | `director` | `report:approve` (Level 2 oversight), `plan:read` | Reviews technical QA and signs Level 2 executive report approval. |
| **CAE Trainee** (Chief Audit Executive) | `cae` | `plan:approve`, `report:approve` (Level 3 final), `report:issue` | Signs Level 3 final approval and presses the crucial **Issue Report** button (Button 2). |

---

## 📧 Automated Notification Dispatch (The Live Classroom Experience)

When the Manager or Lead initializes the engagement and selects their colleagues in the room:
1. **Auditee Trainee's Inbox Rings:**
   - **Subject:** `Internal Audit Notification: Treasury Operations — Treasury Operations Audit`
   - **Body:** Informs them their entity/process is scheduled for audit, lists planned start/end dates, identifies the Lead Auditor and Audit Manager, explains that operational documentation and cooperation will be required, and provides a direct link to log in to IAMS.
2. **Lead Auditor Trainee's Inbox Rings:**
   - **Subject:** `Lead Auditor Assignment: Treasury Operations Audit`
   - **Body:** Outlines engagement title, reference number, universe entity, audit type, schedule, and **OLA Deadline**.
3. **Audit Manager Trainee's Inbox Rings:**
   - **Subject:** `Audit Manager Assignment: Treasury Operations Audit`
   - **Body:** Confirms oversight assignment, schedule, lead auditor, and auditee.
4. **Supporting Auditor Trainee's Inbox Rings:**
   - **Subject:** `New Audit Assignment: Treasury Operations Audit`
   - **Body:** Details assignment role and OLA deadline.

> 💡 **Classroom Engagement Tip:** As soon as the engagement is created in Module 2, pause for 10 seconds and tell the room: *"Check your email inboxes right now!"* Seeing the personalized notifications land simultaneously on everyone's screens immediately grounds the training in reality.

---

## 🗺️ The Map: 4 Approval Gates & The "Two Buttons" Rule (5 Mins)

### The 4 Approval Gates:
1. **Audit Plan Gate:** 1 Level signed by CAE (`plan:approve`).
2. **Working Paper Gate:** 1 Level signed specifically by the engagement's **Audit Manager**.
3. **Audit Report Gate:** 3 Sequential Levels: Manager → Director (Oversight) → CAE (Final).
4. **Finding Closure Gate:** 2-Step Gate: Lead verifies remediation proof (`followup:verify`), then Manager signs off closure (`finding:close`).

### The "Two Buttons" Rule:
* Human beings only press **TWO manual forward buttons** in the entire lifecycle:
  1. ▶ **Start fieldwork** (`planned` → `in_progress`) — loads control checklist.
  2. ▶ **Issue report** (`under_review` → `reported`) — locks report, makes findings official.
* **The system advances everything else automatically:**
  - ⚙ **To Under Review (QA):** When all checklist items are tested **and** all working papers approved.
  - ⚙ **To Reported:** When report is issued.
  - ⚙ **To Closed:** When the last open finding is approved closed.

---

## 🔑 Crucial Concept: How "Auditee" Works (Answer to Classroom Question)

If a trainee asks: *"When we assign someone as an Auditee or Entity Owner, how does it work? Does their role change?"*

**The Exact Truth:**
1. **Roles never mutate automatically:** Naming someone as an auditee on an engagement or as the owner of an entity in the Universe does **not** change their user account role in the database.
2. **Contextual Scoping (RBAC + Scoping):** 
   - IAMS looks at **who is viewing what**.
   - If the logged-in user is NOT on the audit team (not Lead Auditor, Manager, or Assigned Auditor) and lacks `engagement:read_all`, IAMS treats them as a **restricted auditee**:
     - ❌ **Blocked:** They cannot see internal working papers, draft evidence, or checklists (`403 Forbidden`).
     - ❌ **Draft findings are hidden:** Draft findings are strictly confidential to the audit team until the report is officially issued.
   - **When the Auditee logs in:**
     - Their Home page displays a tailored banner: *"What you need to do here"*.
     - Their outstanding **Evidence Requests (PBC)** appear at the top.
     - Once the report is issued, their assigned **Findings & Follow-ups** appear in their worklist.

---

## 🎬 Step-by-Step Live Classroom Choreography

### Module 2: Engagement Setup & Start Fieldwork (8 Mins)
1. **Manager Trainee (or Facilitator):**
   - Go to **Audit → Plans** → Open approved FY2026 Plan.
   - Click **Initialize Engagement** on "Treasury Operations".
   - Assign colleagues in the room:
     - Lead Auditor: [Select Lead Auditor Trainee]
     - Audit Manager: [Select Audit Manager Trainee]
     - Auditee: [Select Auditee Trainee]
     - Asset in Scope: `AST-001 (Treasury Management System)`
     - Set Planned Start, Planned End, and OLA Deadline.
   - Click **Create**. Engagement opens at status `planned`.
   - 📢 *Checkpoint to Room:* Ask Auditee, Lead, and Manager to verify the automated assignment email in their inboxes!
2. **Lead Auditor Trainee:**
   - Open engagement on their laptop.
   - Click **Start fieldwork** (Button 1).
   - Status changes to `in_progress`.
   - Start date is stamped.
   - Control checklist auto-populates from the audit type rules!

---

### Module 3: Fieldwork, Evidence & Working Papers (17 Mins)
1. **Lead Auditor Trainee:**
   - Go to **Evidence** tab → Click **Request evidence** (PBC).
   - Title: *"Q1 Bank Reconciliation Statements"*, Assignee: [Auditee Trainee].
2. **Auditee Trainee:**
   - On their laptop: Refresh IAMS Home page.
   - Show banner: *"What you need to do here"*.
   - Open outstanding request → Upload any sample file (`.xlsx`, `.docx`, or `.pdf`) → Click Submit.
3. **Lead Auditor Trainee:**
   - Review uploaded file → Click **Accept**.
   - 📢 *Checkpoint to Room:* Point out the **SHA-256 cryptographic hash seal**! Explain tamper-evidence.
   - Go to **Checklist** tab → Find control `FIN-TREAS-001` → Mark **Failed**.
   - Click **Raise finding** directly from the control → Criteria auto-fills!
   - Enter Condition: *"Unreconciled variance in Q1 treasury account."* → Save.
   - ⚠️ *Checkpoint to Room:* Ask Auditee Trainee to check their screen. Can they see this finding? No! Draft findings remain strictly confidential to the audit team until final issuance.
4. **Working Papers Lifecycle & SoD Demo:**
   - Lead Auditor goes to **Working Papers** tab → Click **Create Working Paper** (`WP-01`).
   - Fill in details → Click **Submit**. *(Rule: Only the creator can submit!)*
5. **Audit Manager Trainee:**
   - Open `WP-01` on their laptop → Click **Reject** → Reason: *"Please attach sample testing methodology for Feb."*
6. **Lead Auditor Trainee:**
   - Edit `WP-01` → Click **Resubmit**.
7. **Audit Manager Trainee:**
   - Open `WP-01` → Click **Approve**.
8. **💥 WATCH THE SCREEN (Quality Gate Automation):**
   - Because all checklist items are tested and all working papers are approved, **the engagement status automatically turns to `under_review` (Quality Assurance) with NO button pressed!**

---

### Module 4: Audit Review & 3-Tier Executive Sign-Off (12 Mins)
1. **Lead Auditor Trainee:**
   - Open **Report / Review** tab.
   - Show how Findings, Tested Controls, and Assets in scope are **auto-assembled** without copy-pasting.
   - Click **Submit review**.
2. **Sequential Approval Chain (Gate 3):**
   - **Audit Manager Trainee:** Opens Review → Signs & Approves **Level 1**.
   - **Director Trainee:** Opens Review → Signs & Approves **Level 2 (Oversight)**.
   - **CAE Trainee:** Opens Review → Signs & Approves **Level 3 (Final)**.
3. **Issuing the Report (Button 2 — CAE Only):**
   - Point out: *Status is 'Approved', but NOT yet issued.*
   - CAE Trainee clicks **Issue report**.
   - Report is permanently locked! Download executive PDF with digital signatures.
   - Status changes to `reported`.
   - Follow-up remediation loop automatically opens on every finding!

---

### Module 5: Remediation Follow-up & The Closed Loop (12 Mins)
1. **Auditee Trainee:**
   - Refresh Findings page on their laptop: **The finding is now visible!**
   - Click finding → Submit Management Response: *"Dual authorization implemented."*
   - Under Follow-up → Upload a sample document as Remediation Proof.
2. **Lead Auditor Trainee:**
   - Open Follow-up tab on their laptop → Inspect evidence file → Click **Verify Remediation**.
   - ⚠️ *Explain SoD:* Auditees CANNOT verify their own remediation (`403 Forbidden`).
   - Click **Request Closure**.
3. **Audit Manager Trainee:**
   - Approvals Inbox → Finding Closure → Click **Approve Closure**.
   - Finding is now **Closed**.
4. **💥 WATCH THE SCREEN (The Full Loop Closes):**
   - Because the last finding is closed, **the engagement automatically turns to `closed`!**
   - Actual end date is permanently stamped.
   - Navigate to **Audit Universe**: Point out that `Treasury Operations` now has its **Last Audited Date stamped today**!
   - Explain: *This exact date feeds next year's planning priority formula.*

---

## ⚠️ Five Things Trainees Always Get Wrong (6 Mins)

1. **"I have the permission, why can't I approve?"**
   - *Reason:* **Segregation of Duties (SoD)** blocks self-approval. Whoever created/submitted an item cannot approve it. Someone else must sign.
2. **"Approving the report issues it."**
   - *Reason:* Level 3 approval verifies technical correctness; only **`report:issue`** makes it official and triggers auditee follow-up.
3. **"The auditee can't see the draft finding — that's a bug."**
   - *Reason:* It is intentional. Findings stay internal to the audit team until the CAE issues the final report.
4. **"The engagement is stuck, where is the button?"**
   - *Reason:* There is no manual button. Look at the **What's Next** panel to see which checklist test, working paper, or finding closure is pending.
5. **"Role X can do Y."**
   - *Reason:* Roles are configurable bundles of permissions. Always teach the **permission slug** (`plan:approve`, `report:issue`, `followup:verify`), not the job title.
