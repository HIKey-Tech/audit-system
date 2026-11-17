# GBB Internal Audit — role → permission map

Generated from `src/modules/user/utility/gbb-audit-roles.ts` (do not edit by hand).

| Role (stored name) | Who | Permissions |
|---|---|---|
| `head_internal_audit` | Head, Internal Audit | 102 |
| `financial_auditor` | Financial Auditor | 93 |
| `compliance_auditor` | Compliance Auditor | 94 |
| `system_auditor` | System Auditor | 103 |
| `dg` | Director General | 47 |

| Permission | What it does | Head, Internal Audit | Financial Auditor | Compliance Auditor | System Auditor | Director General |
|---|---|---|---|---|---|---|
| **user** |  ||||||
| `auth:logout` | Logout current session |  |  |  |  |  |
| `auth:logout_all` | Logout all sessions |  |  |  |  |  |
| `user:read` | View users | ✓ | ✓ | ✓ | ✓ |  |
| `user:directory` | Look up the basic staff directory for assignment pickers | ✓ | ✓ | ✓ | ✓ | ✓ |
| `user:create` | Create users |  |  |  |  |  |
| `user:update` | Update users | ✓ |  |  |  |  |
| `user:deactivate` | Activate and deactivate users |  |  |  |  |  |
| `user:delete` | Delete users |  |  |  |  |  |
| `user:admin` | Manage user roles and permissions |  |  |  |  |  |
| `user:reset_2fa` | Reset a user's two-factor authentication (lockout recovery) |  |  |  |  |  |
| `role:read` | View roles | ✓ | ✓ | ✓ | ✓ |  |
| `role:create` | Create roles |  |  |  |  |  |
| `role:update` | Update roles |  |  |  |  |  |
| `role:delete` | Delete roles |  |  |  |  |  |
| `role:assign` | Assign roles to users |  |  |  |  |  |
| `permission:read` | View permissions | ✓ | ✓ | ✓ | ✓ |  |
| **document** |  ||||||
| `document:read` | View documents | ✓ | ✓ | ✓ | ✓ | ✓ |
| `document:write` | Upload and create documents | ✓ | ✓ | ✓ | ✓ |  |
| `document:delete` | Delete documents |  |  |  |  |  |
| `document_template:read` | View document templates | ✓ | ✓ | ✓ | ✓ |  |
| `document_template:write` | Create and update document templates |  |  |  |  |  |
| `document_template:delete` | Delete document templates |  |  |  |  |  |
| **logging** |  ||||||
| `log:read` | View audit logs | ✓ | ✓ | ✓ | ✓ | ✓ |
| `log:summary` | View audit log summary and aggregate stats | ✓ |  |  |  |  |
| `log:export` | Export the audit trail to CSV or Excel | ✓ | ✓ | ✓ | ✓ | ✓ |
| **messaging** |  ||||||
| `notification:read` | View notifications | ✓ | ✓ | ✓ | ✓ | ✓ |
| `notification:update` | Mark notifications as read | ✓ | ✓ | ✓ | ✓ | ✓ |
| `notification_template:read` | View notification templates | ✓ |  |  |  |  |
| `notification_template:write` | Create and update notification templates |  |  |  |  |  |
| `notification_template:delete` | Delete notification templates |  |  |  |  |  |
| `notification_queue:read` | View notification queue stats |  |  |  |  |  |
| **background** |  ||||||
| `job:read` | View background jobs | ✓ |  |  |  |  |
| `job:admin` | Enable and disable background jobs |  |  |  |  |  |
| **workflow** |  ||||||
| `approval:read` | View approvals | ✓ | ✓ | ✓ | ✓ | ✓ |
| `approval:approve` | Approve approval steps | ✓ | ✓ | ✓ | ✓ | ✓ |
| `approval:reject` | Reject approval steps | ✓ | ✓ | ✓ | ✓ | ✓ |
| `approval:cancel` | Cancel approvals | ✓ |  |  |  |  |
| `assignment:read` | View assignments | ✓ | ✓ | ✓ | ✓ | ✓ |
| `assignment:create` | Create assignments | ✓ | ✓ | ✓ | ✓ |  |
| `assignment:delete` | Remove assignments | ✓ | ✓ | ✓ | ✓ |  |
| `escalation:read` | View escalations | ✓ | ✓ | ✓ | ✓ | ✓ |
| `escalation:acknowledge` | Acknowledge escalations | ✓ | ✓ | ✓ | ✓ | ✓ |
| `escalation_policy:read` | View escalation policies | ✓ | ✓ | ✓ | ✓ |  |
| `escalation_policy:update` | Update escalation policies | ✓ |  |  |  |  |
| `request:create` | Initiate ad-hoc workflow requests | ✓ | ✓ | ✓ | ✓ | ✓ |
| `request:read` | View ad-hoc workflow requests | ✓ | ✓ | ✓ | ✓ | ✓ |
| `request:receive` | Be eligible as a request recipient | ✓ | ✓ | ✓ | ✓ | ✓ |
| `request:act` | Approve, sign, reject, or comment on requests | ✓ | ✓ | ✓ | ✓ | ✓ |
| `request:admin` | Administer and cancel any request | ✓ |  |  |  |  |
| **audit** |  ||||||
| `universe:read` | View audit universe entities | ✓ | ✓ | ✓ | ✓ | ✓ |
| `universe:create` | Create audit universe entities | ✓ | ✓ | ✓ | ✓ |  |
| `universe:update` | Update audit universe entities | ✓ | ✓ | ✓ | ✓ |  |
| `universe:delete` | Delete audit universe entities | ✓ |  |  |  |  |
| `plan:read` | View audit plans | ✓ | ✓ | ✓ | ✓ | ✓ |
| `plan:create` | Create audit plans |  | ✓ | ✓ | ✓ |  |
| `plan:update` | Update audit plans |  | ✓ | ✓ | ✓ |  |
| `plan:add_item` | Add items to audit plans |  | ✓ | ✓ | ✓ |  |
| `plan:submit` | Submit audit plans for approval |  | ✓ | ✓ | ✓ |  |
| `plan:approve` | Approve audit plans | ✓ |  |  |  | ✓ |
| `plan:reject` | Reject audit plans | ✓ |  |  |  | ✓ |
| `engagement:read` | View audit engagements | ✓ | ✓ | ✓ | ✓ | ✓ |
| `engagement:create` | Create audit engagements | ✓ | ✓ | ✓ | ✓ |  |
| `engagement:update` | Update audit engagements | ✓ | ✓ | ✓ | ✓ |  |
| `engagement:delete` | Delete audit engagements | ✓ |  |  |  |  |
| `checklist:read` | View audit checklists | ✓ | ✓ | ✓ | ✓ | ✓ |
| `checklist:create` | Add audit checklist items |  | ✓ | ✓ | ✓ |  |
| `checklist:update` | Update checklist items |  | ✓ | ✓ | ✓ |  |
| `working_paper:read` | View working papers | ✓ | ✓ | ✓ | ✓ | ✓ |
| `working_paper:create` | Create working papers |  | ✓ | ✓ | ✓ |  |
| `working_paper:update` | Update working papers |  | ✓ | ✓ | ✓ |  |
| `working_paper:submit` | Submit working papers for review |  | ✓ | ✓ | ✓ |  |
| `working_paper:approve` | Approve working papers |  | ✓ | ✓ | ✓ |  |
| `working_paper:reject` | Reject working papers |  | ✓ | ✓ | ✓ |  |
| `evidence:read` | View evidence | ✓ | ✓ | ✓ | ✓ | ✓ |
| `evidence:upload` | Upload evidence |  | ✓ | ✓ | ✓ |  |
| `evidence:dispute` | Dispute evidence | ✓ | ✓ | ✓ | ✓ |  |
| `evidence:request` | Request evidence from auditees |  | ✓ | ✓ | ✓ |  |
| `finding:read` | View findings | ✓ | ✓ | ✓ | ✓ | ✓ |
| `finding:create` | Create findings |  | ✓ | ✓ | ✓ |  |
| `finding:update` | Update findings | ✓ | ✓ | ✓ | ✓ |  |
| `finding:close` | Close findings |  | ✓ | ✓ | ✓ |  |
| `finding:export` | Export the findings register to CSV or Excel | ✓ | ✓ | ✓ | ✓ | ✓ |
| `followup:read` | View follow-ups | ✓ | ✓ | ✓ | ✓ | ✓ |
| `followup:respond` | Submit management responses |  |  |  |  |  |
| `followup:evidence` | Submit remediation evidence |  |  |  |  |  |
| `followup:verify` | Verify remediation |  | ✓ | ✓ | ✓ |  |
| `report:read` | View audit reports | ✓ | ✓ | ✓ | ✓ | ✓ |
| `report:create` | Generate audit reports |  | ✓ | ✓ | ✓ |  |
| `report:update` | Update audit reports |  | ✓ | ✓ | ✓ |  |
| `report:submit` | Submit reports for approval |  | ✓ | ✓ | ✓ |  |
| `report:approve` | Approve audit reports |  | ✓ | ✓ | ✓ |  |
| `report:approve:oversight` | Designated oversight sign-off in the audit report approval chain | ✓ |  |  |  |  |
| `report:approve:final` | Designated final executive sign-off in the audit report approval chain |  |  |  |  | ✓ |
| `report:reject` | Reject audit reports | ✓ | ✓ | ✓ | ✓ |  |
| `report:issue` | Issue audit reports | ✓ |  |  |  |  |
| `report:export` | Export audit reports | ✓ | ✓ | ✓ | ✓ | ✓ |
| `control:read` | View compliance frameworks and controls | ✓ | ✓ | ✓ | ✓ |  |
| `control:manage` | Create, update, and retire compliance frameworks and controls | ✓ |  | ✓ |  |  |
| `engagement:read_all` | View all audit engagements | ✓ | ✓ | ✓ | ✓ | ✓ |
| `engagement:notify_lifecycle` | Receive notifications whenever any engagement starts, changes stage, or closes | ✓ | ✓ | ✓ | ✓ | ✓ |
| `finding:read_all` | View all findings | ✓ | ✓ | ✓ | ✓ | ✓ |
| **risk** |  ||||||
| `risk_category:read` | View risk categories | ✓ | ✓ | ✓ | ✓ |  |
| `risk_category:write` | Create and update risk categories | ✓ | ✓ | ✓ | ✓ |  |
| `risk_category:delete` | Delete risk categories | ✓ |  |  |  |  |
| `risk:read` | View risks | ✓ | ✓ | ✓ | ✓ | ✓ |
| `risk:create` | Create risks | ✓ | ✓ | ✓ | ✓ |  |
| `risk:update` | Update risks | ✓ | ✓ | ✓ | ✓ |  |
| `risk:delete` | Delete risks | ✓ |  |  |  |  |
| `risk:assess` | Assess risks | ✓ | ✓ | ✓ | ✓ |  |
| `risk_monitoring:read` | View risk monitoring data | ✓ | ✓ | ✓ | ✓ | ✓ |
| `risk:export` | Export the risk register to CSV or Excel | ✓ | ✓ | ✓ | ✓ | ✓ |
| `risk:read_all` | View all risks in the organization | ✓ | ✓ | ✓ | ✓ | ✓ |
| **dashboard** |  ||||||
| `dashboard:read` | View dashboard data | ✓ | ✓ | ✓ | ✓ | ✓ |
| `committee_pack:read` | View and export the audit committee pack | ✓ |  |  |  | ✓ |
| **asset** |  ||||||
| `asset:read` | View asset registry records | ✓ | ✓ | ✓ | ✓ | ✓ |
| `asset:create` | Create asset registry records | ✓ |  |  | ✓ |  |
| `asset:update` | Update asset registry records | ✓ |  |  | ✓ |  |
| `asset:delete` | Delete asset registry records | ✓ |  |  |  |  |
| `asset:admin` | Administer asset classification, lifecycle, and source records | ✓ |  |  | ✓ |  |
| `asset:attest` | Attest assigned asset ownership and accuracy |  | ✓ | ✓ | ✓ |  |
| `asset:import` | Import asset records from approved read-only sources | ✓ |  |  | ✓ |  |
| `asset:link` | Link assets to audit universe, engagements, findings, risks, and evidence | ✓ | ✓ | ✓ | ✓ |  |
| `asset:export` | Export asset registry records | ✓ | ✓ | ✓ | ✓ | ✓ |
| **integration** |  ||||||
| `integration:read` | View integration status and configuration | ✓ | ✓ | ✓ | ✓ | ✓ |
| `imoc:read` | View read-only IMOC ticket data linked to audits | ✓ | ✓ | ✓ | ✓ |  |
| `imoc:link` | Link and unlink existing IMOC tickets to audit engagements | ✓ | ✓ | ✓ | ✓ |  |
| `imoc:capture` | Capture redacted IMOC ticket snapshots as audit evidence | ✓ | ✓ | ✓ | ✓ |  |
| `imoc:sync` | Refresh IMOC ticket data and trigger the IMOC sync job | ✓ |  |  | ✓ |  |
| `imoc:rules` | Manage IMOC ticket ingestion rules | ✓ |  |  | ✓ |  |
| `imoc:ingest` | Trigger IMOC ticket ingestion runs | ✓ |  |  | ✓ |  |
| `imoc:export` | Export stored IMOC tickets to spreadsheet or CSV | ✓ | ✓ | ✓ | ✓ |  |
| `projectplus:read` | View read-only Project Plus entities and reference data | ✓ | ✓ | ✓ | ✓ |  |
| `projectplus:link` | Link and unlink Project Plus entities to audit engagements | ✓ | ✓ | ✓ | ✓ |  |
| **predictive** |  ||||||
| `predictive:read` | View predictive analytics insights | ✓ | ✓ | ✓ | ✓ | ✓ |
| **system-audit** |  ||||||
| `sysaudit:read` | View system audit analyses, user access reviews, and continuous monitoring | ✓ | ✓ | ✓ | ✓ | ✓ |
| `sysaudit:run` | Run system audit analyses on uploaded system exports and live read-only sources |  | ✓ | ✓ | ✓ |  |
| `sysaudit:review` | Disposition analysis exceptions, record access-review decisions, and sign off reviews | ✓ | ✓ | ✓ | ✓ |  |
| `sysaudit:admin` | Approve configuration baselines and run continuous monitoring on demand | ✓ |  |  | ✓ |  |
| `sectest:read` | View security tests (vulnerability assessments and penetration tests) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `sectest:manage` | Plan and coordinate security tests, attach reports, and track results |  |  |  | ✓ |  |
| `sectest:authorise` | Authorise a security test to proceed (cannot be the coordinator) | ✓ |  |  |  | ✓ |
| `sysdoc:read` | View the system documentation library (policies, diagrams, manuals, contracts) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `sysdoc:manage` | Add, update, version, and archive system documentation | ✓ |  |  | ✓ |  |
| **settings** |  ||||||
| `settings:read` | View settings | ✓ |  |  |  |  |
| `settings:manage` | Manage system settings | ✓ |  |  |  |  |
| `report_template:manage` | Create and manage audit report templates | ✓ |  |  |  |  |

## Held by none of these roles (super admin only)

- `auth:logout` — Logout current session
- `auth:logout_all` — Logout all sessions
- `user:create` — Create users
- `user:deactivate` — Activate and deactivate users
- `user:delete` — Delete users
- `user:admin` — Manage user roles and permissions
- `user:reset_2fa` — Reset a user's two-factor authentication (lockout recovery)
- `role:create` — Create roles
- `role:update` — Update roles
- `role:delete` — Delete roles
- `role:assign` — Assign roles to users
- `document:delete` — Delete documents
- `document_template:write` — Create and update document templates
- `document_template:delete` — Delete document templates
- `notification_template:write` — Create and update notification templates
- `notification_template:delete` — Delete notification templates
- `notification_queue:read` — View notification queue stats
- `job:admin` — Enable and disable background jobs
- `followup:respond` — Submit management responses
- `followup:evidence` — Submit remediation evidence
