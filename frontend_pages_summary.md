# Frontend Pages Summary

This document lists every page inside the Next.js frontend directory (`app`), its route, functionality status, details on what works/what does not, and the API endpoints it calls.

## 1. Root Redirect
- **Route:** `/`
- **Status:** Fully functional.
- **Details:** Automatically redirects the user to `/dashboard` if they are authenticated (based on the `ACCESS_COOKIE`), or to `/login` if they are not.
- **API Endpoints:** None.

## 2. Login
- **Route:** `/login`
- **Status:** Fully functional.
- **Details:** Provides a login form with field validation using `react-hook-form` and `zod`. It handles the authentication request, manages loading states, displays server-side errors if authentication fails, and supports a `?next=` query parameter for post-login redirect.
- **API Endpoints:** 
  - `POST /api/auth/login` (Uses a direct fetch to the Next.js API route proxy which points to the backend).

## 3. Dashboard
- **Route:** `/dashboard`
- **Status:** Fully functional.
- **Details:** A dynamic landing page tailored to user roles. It selectively renders components such as `StatCards`, `RecentActivity`, `FindingsBySeverity`, `MyWorkPanel`, `TopRisksTable`, and `EscalationsCard` depending on granular permissions. All panels are operational.
- **API Endpoints:** 
  - Does not fetch data globally; individual dashboard components fetch their respective data metrics.

## 4. Audit Engagements List
- **Route:** `/audit/engagements`
- **Status:** Fully functional.
- **Details:** Displays a paginated data table of all audit engagements. It supports rich filtering (by search term, status, audit type, priority), tabbed filtering (All, My Engagements, Overdue), and navigating to a detailed view. Authorized users can trigger a slide-over to create a new engagement.
- **API Endpoints:** 
  - `GET /api/v1/engagements` (and variants with query params, e.g., `?overdue=true`).

## 5. Audit Engagement Detail
- **Route:** `/audit/engagements/[id]`
- **Status:** Fully functional.
- **Details:** Renders comprehensive details of a specific audit engagement broken down into tabs: Overview, Working Papers, Evidence, Findings, Checklists, Report, and Follow-up. The header displays the status and a back button.
- **API Endpoints:** 
  - `GET /api/v1/engagements/{id}`.

## 6. Findings List
- **Route:** `/audit/findings`
- **Status:** Fully functional.
- **Details:** Displays a paginated list of all findings across the system. It features robust filtering by search keyword, severity, status, and category. Rows are clickable and link to the detailed finding page.
- **API Endpoints:** 
  - `GET /api/v1/findings`.

## 7. Finding Detail
- **Route:** `/audit/findings/[id]`
- **Status:** Fully functional.
- **Details:** Shows a comprehensive overview of a finding (severity, status, root cause, recommendation, etc.) and its associated follow-up record (verification, management response). Authorized roles (like `audit_admin` or `cae`) can update the finding status via a dropdown in the header.
- **API Endpoints:** 
  - `GET /api/v1/findings/{id}`
  - `GET /api/v1/findings/{id}/follow-up`
  - `PUT /api/v1/findings/{id}/status`

## 8. Audit Plans List
- **Route:** `/audit/plans`
- **Status:** Fully functional.
- **Details:** Lists annual audit plans with filtering capabilities by year (dynamically generated relative to the current year) and plan status (Draft, Submitted, Approved, Rejected). Supports pagination and provides a slide-over form for creating a new plan.
- **API Endpoints:** 
  - `GET /api/v1/plans`.

## 9. Audit Plan Detail
- **Route:** `/audit/plans/[id]`
- **Status:** Fully functional.
- **Details:** Shows the plan's summary, the full approval chain, and its planned items. It supports complete workflow actions: users can submit a draft for approval, and admins can approve or reject (with required reason). Authorized users can add auditable entities to a draft plan or initiate an engagement directly from an approved plan item.
- **API Endpoints:** 
  - `GET /api/v1/plans/{id}`
  - `POST /api/v1/plans/{id}/submit`
  - `POST /api/v1/plans/{id}/approve`
  - `POST /api/v1/plans/{id}/reject`

## 10. Audit Reports List
- **Route:** `/audit/reports`
- **Status:** Fully functional.
- **Details:** Displays a paginated table of audit reports with tabs to filter by status (Draft, Submitted, Approved, Rejected, Issued). Clicking a row redirects the user to the report's parent engagement detail page.
- **API Endpoints:** 
  - `GET /api/v1/reports`.

## 11. Audit Universe List
- **Route:** `/audit/universe`
- **Status:** Fully functional.
- **Details:** Displays a registry of all auditable entities (departments, systems, processes, etc.) complete with risk scores. It supports pagination, search, and filtering by category or status. Users with the correct permissions can create new entities via a slide-over.
- **API Endpoints:** 
  - `GET /api/v1/universe`.

## 12. Audit Universe Detail
- **Route:** `/audit/universe/[id]`
- **Status:** Fully functional.
- **Details:** Presents the entity's profile, including its calculated risk score, an embedded table of linked risks from the risk register, and a history of engagements run against it. Authorized users can edit the entity details.
- **API Endpoints:** 
  - `GET /api/v1/universe/{id}`.

## 13. Documents
- **Route:** `/documents`
- **Status:** Fully functional.
- **Details:** Acts as a generic document explorer. Users must select an entity type (e.g., Audit Engagement, Finding) and supply an entity ID to list associated documents. Features include uploading new files to the entity, downloading existing ones, and viewing a slide-over of document version history.
- **API Endpoints:** 
  - `GET /api/v1/documents` (with query parameters `entityType` and `entityId`)
  - `POST /api/v1/documents`
  - `GET /api/v1/documents/{id}/versions`
  - Uses `documentsApi.downloadUrl(id)` to construct direct download links.

## 14. Integrations
- **Route:** `/integrations`
- **Status:** Just a shell.
- **Details:** Displays a "Coming Soon" placeholder UI. No backend logic is implemented for this module yet.
- **API Endpoints:** None.

## 15. Logs
- **Route:** `/logs`
- **Status:** Fully functional.
- **Details:** Shows a tamper-evident audit trail of actions performed within the system. It offers comprehensive filtering (by action search, module, status, date range) and pagination. Clicking a log entry opens a detailed slide-over displaying the raw JSON payload (old values, new values, metadata, IP, user agent).
- **API Endpoints:** 
  - `GET /api/v1/logs/modules`
  - `GET /api/v1/logs`

## 16. Notifications
- **Route:** `/notifications`
- **Status:** Fully functional.
- **Details:** Displays system notifications to the user with tabs filtering for "All" or "Unread". Users can mark individual notifications as read or use a bulk "Mark all read" button. Clicking a notification correctly routes the user to the referenced entity based on the `referenceType`.
- **API Endpoints:** 
  - `GET /api/v1/notifications`
  - `PUT /api/v1/notifications/{id}/read`
  - `POST /api/v1/notifications/read-all`

## 17. Predictive Analytics
- **Route:** `/predictive`
- **Status:** Just a shell.
- **Details:** Displays a "Coming Soon" placeholder UI indicating future AI capabilities.
- **API Endpoints:** None.

## 18. Risk Register
- **Route:** `/risk`
- **Status:** Fully functional.
- **Details:** Features two main tabs: 
  - **Register:** Lists enterprise risks with filtering by category, status, search string, and score band. Allows creating new risks.
  - **Monitoring:** Presents high-level risk metrics (Critical+High totals, stale risk count, organisation summary) and a table of the top 5 highest risks.
- **API Endpoints:** 
  - `GET /api/v1/risks/categories`
  - `GET /api/v1/risks`
  - `GET /api/v1/risks/summary`
  - `GET /api/v1/risks/high`
  - `GET /api/v1/risks/attention`

## 19. Risk Detail
- **Route:** `/risk/[id]`
- **Status:** Fully functional.
- **Details:** Shows the detailed profile of a specific risk including its current Likelihood × Impact. Visualizes the risk score trend over time using an SVG sparkline and lists the complete assessment history. Users with permissions can record a new assessment.
- **API Endpoints:** 
  - `GET /api/v1/risks/{id}`
  - `GET /api/v1/risks/{id}/assessments`
  - `GET /api/v1/risks/{id}/trend`

## 20. Settings
- **Route:** `/settings`
- **Status:** Just a shell.
- **Details:** Displays a "Coming Soon" placeholder UI. Configuration and user management capabilities are not yet built out here.
- **API Endpoints:** None.

## 21. Workflow
- **Route:** `/workflow`
- **Status:** Fully functional.
- **Details:** Central hub for managing operational workflows. It comprises four functional tabs:
  - **Approval Inbox:** Lists pending items waiting for the user's approval. Users can approve or reject (with a required reason).
  - **Assignments:** Lists the staff assignments for the current user and allows admins/leads to assign staff to engagements via a slide-over.
  - **Escalations:** Notes that detailed escalation tracking is handled per-entity on their respective detail views.
  - **Policies (Admin only):** Displays a configuration table for setting the hour thresholds (L1, L2, L3, L4) for escalations per audit type. Admins can save these configurations.
- **API Endpoints:** 
  - `GET /api/v1/workflow/pending`
  - `POST /api/v1/workflow/{id}/approve`
  - `POST /api/v1/workflow/{id}/reject`
  - `GET /api/v1/workflow/assignments/mine`
  - `POST /api/v1/workflow/assignments`
  - `GET /api/v1/workflow/policies`
  - `POST /api/v1/workflow/policies` (upsert action)
  - `POST /api/v1/workflow/escalations/{id}/acknowledge` (used elsewhere or as a fallback)
