# SP4 — Navigation & IA Clarity — Design

> Status: Approved (design) · Date: 2026-06-08 · Branch: `sp4-nav-ia-clarity`
> Author: Wole + Claude · Final sub-project of the IAMS frontend refinement programme (follows SP1–SP3)

---

## 1. Background & problem

The original complaint was "clear distinction of the pages in the nav bar." SP1 already added
per-item description tooltips to the sidebar. Auditing the current navigation surfaced a small
set of concrete, low-risk issues — not a need to re-architect:

1. **Label↔heading mismatch.** The sidebar item is labelled **"Approvals"** but its page
   (`/workflow`) has the heading **"Workflow"** and actually spans four tabs — Approval inbox,
   Assignments, Escalations, Policies (`workflow/page.tsx:55`). The label undersells and
   mislabels the page, and makes "Approvals" sound interchangeable with the separate
   **"Requests"** item.
2. **Tabs are not URL-addressable.** `/workflow` (inbox/assignments/escalations/policies) and
   `/risk` (register/monitoring) keep the active tab in `useState`, so you cannot deep-link,
   bookmark, or land on a specific tab from a link/notification.
3. **`requests/[id]` lacks a breadcrumb.** Every other detail page
   (engagements/findings/plans/universe/risk) renders a `PageHeader` breadcrumb back to its
   list; the request detail page does not, so orientation is inconsistent.
4. **`frontend_pages_summary.md` is stale.** It calls Settings "just a shell" (it is fully
   built), predates the Requests/Analytics pages and the renamed nav, and predates SP1–SP3.

The three-section grouping (Workspace / Audit Library / Administration) and the rest of the
page headers are sound and stay as-is.

---

## 2. Goals / non-goals

### Goals
- Make the nav label match its page and sharpen the Workflow-vs-Requests distinction.
- Make `/workflow` and `/risk` tabs **URL-addressable** via a `?tab=` query param
  (deep-link, bookmark, back/forward).
- Give `requests/[id]` a breadcrumb consistent with the other detail pages.
- Add a "Workspace" section label above the first nav group for symmetry.
- Bring `frontend_pages_summary.md` back in sync with the real app.

### Non-goals
- Re-architecting the nav grouping or routes.
- Any permission/visibility (`getNavVisibility`) change.
- Any backend / API change.
- Wiring notification click-throughs to the new deep links (kept out per scope choice
  "Full", not "Full + notifications deep-link").

---

## 3. Units & changes (all frontend, under `frontend/`)

| Unit | File | Change |
|---|---|---|
| Sidebar nav | `components/layout/Sidebar.tsx` | rename "Approvals" → "Workflow"; update its description; add a "Workspace" section label for the first group |
| Workflow tabs | `app/(app)/workflow/page.tsx` | sync active tab with `?tab=` query param |
| Risk tabs | `app/(app)/risk/page.tsx` | sync active tab with `?tab=` query param |
| Request detail | `app/(app)/requests/[id]/page.tsx` | add a `Requests → {title}` breadcrumb |
| Pages doc | `frontend_pages_summary.md` | refresh to match the current app |

### 3.1 Sidebar
- In the `NAV` array, change the item `{ label: 'Approvals', href: '/workflow', … }` to
  `label: 'Workflow'`, and update its SP1 `description` to reflect the full scope, e.g.
  *"Your approval inbox, staff assignments, and escalation tracking."* `matchPrefix`
  stays `/workflow`; `visKey` stays `workflow`.
- Add a "Workspace" section label above the first group. The first group currently has no
  divider/header (the others do). Render a label-only header (no top border, to avoid a rule
  at the very top of the list) so it reads symmetrically with "Audit Library" /
  "Administration". Hidden when the sidebar is collapsed (consistent with the other section
  labels).

### 3.2 URL-addressable tabs (`/workflow` and `/risk`)
Pattern (applied to both pages, each with its own valid tab keys):
- Read the initial tab from the URL: `useSearchParams().get('tab')`, validated against the
  page's known keys, falling back to the current default (`inbox` for workflow,
  `register` for risk).
- Initialize the existing `useState` from that value.
- On tab change, besides `setTab`, update the URL with
  `router.replace(\`?tab=${key}\`, { scroll: false })` so the address bar reflects the tab
  without a full navigation or scroll jump.
- Invalid/missing `?tab=` → default tab (no error).
- No change to tab content, permissions, or data fetching.

### 3.3 Request detail breadcrumb
- In `requests/[id]/page.tsx`, add `breadcrumbs={[{ label: 'Requests', href: '/requests' }]}`
  to the loaded `PageHeader` (and the loading/early-return `PageHeader`s), matching the exact
  pattern used by `engagements/[id]`, `findings/[id]`, etc.

### 3.4 Pages doc refresh
- Rewrite `frontend_pages_summary.md` so each route's status/description matches the current
  app: Settings is built (not a shell); add Requests, Analytics; reflect the renamed
  "Workflow" nav item, the SP3 Start-Audit wizard entry points, and the SP2 template flows.
  Keep the existing one-section-per-route structure.

---

## 4. Data flow, errors, compatibility

- **Data flow:** tab state still lives in component `useState`; the URL is a mirror
  (read on mount, written on change). `router.replace` (not `push`) avoids polluting history
  with every tab click while still making the URL shareable.
- **Errors:** an unknown `?tab=` value falls back to the default tab silently.
- **Compatibility:** purely cosmetic/navigational and additive. Renaming the nav label does
  not change the route (`/workflow`) or its `visKey`, so visibility/permissions are
  unaffected. Existing links to `/workflow` and `/risk` (no query param) keep working and land
  on the default tab. No backend, no API, no schema.

---

## 5. Verification

- **Frontend:** `npx tsc --noEmit` + `npm run build` pass.
- **Manual:**
  - Sidebar shows "Workflow" (not "Approvals"); its tooltip describes inbox + assignments +
    escalations; a "Workspace" label sits above the first group.
  - Visiting `/workflow?tab=escalations` lands on the Escalations tab; switching tabs updates
    the address bar; `/workflow` with no param shows the inbox.
  - `/risk?tab=monitoring` lands on Monitoring; default is Register.
  - A request detail page shows a "Requests" breadcrumb that returns to the list.
  - `frontend_pages_summary.md` matches the current routes/states.
- **Tech debt (unchanged):** no automated frontend tests; build + manual gates apply.

---

## 6. Roadmap context

Final sub-project of the programme:
- **SP1 — UI foundations & help layer** — merged.
- **SP2 — Template integration** — merged.
- **SP3 — Start-Audit guided wizard** — merged.
- **SP4 — Navigation & IA clarity** (this doc).
