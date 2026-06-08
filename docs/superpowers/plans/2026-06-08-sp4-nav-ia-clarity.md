# SP4 — Navigation & IA Clarity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the nav label with its page, make `/workflow` and `/risk` tabs URL-addressable, add the missing request-detail breadcrumb, add a "Workspace" section label, and refresh the stale pages-summary doc.

**Architecture:** Frontend-only, additive, navigational/cosmetic. Tab state stays in `useState` but mirrors a `?tab=` query param (read on mount, `router.replace` on change). No permission/route/backend changes.

**Tech Stack:** Next.js 14 (App Router, `next/navigation`), React 18, TypeScript, Tailwind.

**Working dir:** all commands from `audit-system/frontend/`. Windows/PowerShell; git branch `sp4-nav-ia-clarity`.

**Per-task verification:** `npx tsc --noEmit` (from `frontend/`) after each task — no errors. Final task runs `npm run build` (also catches any `useSearchParams`/Suspense issue). No backend/DB/test runner.

---

## File map

| File | Action | Change |
|---|---|---|
| `components/layout/Sidebar.tsx` | modify | rename "Approvals"→"Workflow" + description; add "Workspace" section label |
| `app/(app)/workflow/page.tsx` | modify | sync active tab with `?tab=` |
| `app/(app)/risk/page.tsx` | modify | sync active tab with `?tab=` |
| `app/(app)/requests/[id]/page.tsx` | modify | add Requests breadcrumb |
| `frontend_pages_summary.md` | modify | refresh to current app |

---

## Task 1: Sidebar — rename + Workspace section label

**Files:**
- Modify: `frontend/components/layout/Sidebar.tsx`

- [ ] **Step 1: Rename the Workflow item and update its description**

In the `NAV` array, find the item with `href: '/workflow'` (currently `label: 'Workflow'`? it is `label: 'Approvals'`). Change its `label` to `'Workflow'` and its `description` to:

```ts
{ type: 'link', label: 'Workflow', href: '/workflow', icon: CheckSquare, matchPrefix: '/workflow', visKey: 'workflow', description: 'Your approval inbox, staff assignments, and escalation tracking.' },
```

(Keep `icon`, `matchPrefix`, `visKey` exactly as they were; only `label` and `description` change.)

- [ ] **Step 2: Add a "Workspace" section label above the first group**

The first nav group (Home … Notifications) currently has no section header, unlike "Audit Library" and "Administration". Insert a divider as the FIRST element of the `NAV` array, before the Home item:

```ts
{ type: 'divider', label: 'Workspace' },
```

(Dividers without `sectionKeys` always render. The existing divider renderer shows the label when expanded and hides it when collapsed — no other change needed.)

- [ ] **Step 3: Type gate**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 4: Manual check**

`npm run dev`: the sidebar shows a "Workspace" label above Home, and the item formerly "Approvals" now reads "Workflow" with the updated hover description.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/layout/Sidebar.tsx
git commit -m "feat(nav): rename Approvals to Workflow and add Workspace section label"
```

---

## Task 2: URL-addressable tabs on `/workflow`

**Files:**
- Modify: `frontend/app/(app)/workflow/page.tsx`

Context: `TabKey = 'inbox' | 'assignments' | 'escalations' | 'policies'`; the component currently does `const [tab, setTab] = useState<TabKey>('inbox')` and `<Tabs … onChange={(k) => setTab(k as TabKey)} />`. Only `useState` is imported from React; `next/navigation` is not yet imported here.

- [ ] **Step 1: Import router + search params**

Add after the existing React import line (`import { useState } from 'react';`):

```tsx
import { useRouter, useSearchParams } from 'next/navigation';
```

- [ ] **Step 2: Initialize the tab from the URL and mirror changes**

Replace `const [tab, setTab] = useState<TabKey>('inbox');` with:

```tsx
  const router = useRouter();
  const searchParams = useSearchParams();
  const VALID_TABS: TabKey[] = ['inbox', 'assignments', 'escalations', 'policies'];
  const tabParam = searchParams.get('tab');
  const initialTab: TabKey = VALID_TABS.includes(tabParam as TabKey) ? (tabParam as TabKey) : 'inbox';
  const [tab, setTab] = useState<TabKey>(initialTab);

  const changeTab = (k: TabKey): void => {
    setTab(k);
    router.replace(`?tab=${k}`, { scroll: false });
  };
```

- [ ] **Step 3: Route the Tabs change through `changeTab`**

Change the `<Tabs … onChange={(k) => setTab(k as TabKey)} />` to:

```tsx
<Tabs tabs={tabs} active={tab} onChange={(k) => changeTab(k as TabKey)} />
```

- [ ] **Step 4: Type gate**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/(app)/workflow/page.tsx
git commit -m "feat(workflow): make tabs URL-addressable via ?tab="
```

---

## Task 3: URL-addressable tabs on `/risk`

**Files:**
- Modify: `frontend/app/(app)/risk/page.tsx`

Context: this page already imports `useRouter` from `next/navigation` and uses it for row navigation. Tab state: `const [tab, setTab] = useState<'register' | 'monitoring'>('register')`; `<Tabs … onChange={(k) => setTab(k as 'register' | 'monitoring')} />`.

- [ ] **Step 1: Add `useSearchParams` to the existing next/navigation import**

Change `import { useRouter } from 'next/navigation';` to:

```tsx
import { useRouter, useSearchParams } from 'next/navigation';
```

- [ ] **Step 2: Initialize from the URL and mirror changes**

Replace `const [tab, setTab] = useState<'register' | 'monitoring'>('register');` with:

```tsx
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab: 'register' | 'monitoring' = tabParam === 'monitoring' ? 'monitoring' : 'register';
  const [tab, setTab] = useState<'register' | 'monitoring'>(initialTab);

  const changeTab = (k: 'register' | 'monitoring'): void => {
    setTab(k);
    router.replace(`?tab=${k}`, { scroll: false });
  };
```

(`router` is already declared above from the existing `useRouter()` call — do not re-declare it.)

- [ ] **Step 3: Route the Tabs change through `changeTab`**

Change `<Tabs tabs={TABS} active={tab} onChange={(k) => setTab(k as 'register' | 'monitoring')} />` to:

```tsx
<Tabs tabs={TABS} active={tab} onChange={(k) => changeTab(k as 'register' | 'monitoring')} />
```

- [ ] **Step 4: Type gate**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/(app)/risk/page.tsx
git commit -m "feat(risk): make register/monitoring tabs URL-addressable via ?tab="
```

---

## Task 4: Request-detail breadcrumb

**Files:**
- Modify: `frontend/app/(app)/requests/[id]/page.tsx`

Context: every other detail page passes `breadcrumbs` to `PageHeader` (e.g. `engagements/[id]` uses `breadcrumbs={[{ label: 'Engagements', href: '/audit/engagements' }]}`). The request detail page renders `PageHeader` (loaded state `title={req.title}`, plus any loading/early-return `PageHeader`s) without breadcrumbs.

- [ ] **Step 1: Add the breadcrumb to every `PageHeader` in the file**

To each `<PageHeader …>` in `requests/[id]/page.tsx` (the loaded one and any loading/not-found ones), add:

```tsx
breadcrumbs={[{ label: 'Requests', href: '/requests' }]}
```

For example the loaded header becomes:

```tsx
<PageHeader title={req.title} breadcrumbs={[{ label: 'Requests', href: '/requests' }]} … />
```

(Preserve any existing `subtitle`/`actions` props on those headers.)

- [ ] **Step 2: Type gate**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/(app)/requests/[id]/page.tsx
git commit -m "feat(requests): add breadcrumb to request detail page"
```

---

## Task 5: Refresh `frontend_pages_summary.md`

**Files:**
- Modify: `frontend_pages_summary.md` (repo root)

Context: the doc is stale. Update it to match the current app, keeping the existing one-section-per-route structure (Route / Status / Details / API Endpoints).

- [ ] **Step 1: Apply these corrections**

Read the current `frontend_pages_summary.md`, then update it so it is accurate:
- **Settings (`/settings`):** change from "just a shell" to **Fully functional** — role administration, working-paper templates, report templates, and system config tabs.
- **Workflow (`/workflow`):** note the nav label is now **"Workflow"** (was "Approvals"); tabs are Approval Inbox / Assignments / Escalations / Policies and are **deep-linkable via `?tab=`**.
- **Add a section for Requests (`/requests` and `/requests/[id]`):** ad-hoc information/evidence requests to and from auditees (initiated/received, attachments, sign-off).
- **Add a section for Analytics (`/analytics`):** audit-programme dashboards/metrics.
- **Engagements (`/audit/engagements`):** note creation is now via the **Start-Audit wizard** (create + staff in one flow), reachable from the list and the dashboard "Start audit" CTA.
- **Working papers / Reports (engagement detail):** note **template selection** (working-paper template picker; report template selector with template-driven preview/export) from SP2.
- **Risk (`/risk`):** Register / Monitoring tabs are **deep-linkable via `?tab=`**.
- Remove any statement that contradicts the current build (e.g. "Settings not built"). Keep Integrations and Predictive marked as placeholders ("Coming Soon"), which is still accurate.
- Update the document's intro/date line to note it reflects the post-SP1–SP4 state (2026-06-08).

- [ ] **Step 2: Commit**

```bash
git add frontend_pages_summary.md
git commit -m "docs: refresh frontend pages summary to current app state"
```

---

## Task 6: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Type + build gate**

Run (from `frontend/`): `npx tsc --noEmit && npm run build`
Expected: type check clean; production build succeeds (no `useSearchParams`/Suspense error — the `(app)` layout is `force-dynamic`, so these pages render dynamically). If the build DOES error that `useSearchParams()` must be wrapped in a Suspense boundary, wrap the page's returned JSX in `<Suspense fallback={null}>…</Suspense>` (import `Suspense` from `react`) and re-run.

- [ ] **Step 2: Manual smoke**

- Sidebar: "Workspace" label above Home; "Workflow" item (not "Approvals") with the updated tooltip.
- `/workflow?tab=escalations` opens the Escalations tab; clicking tabs updates the URL; `/workflow` (no param) shows the inbox.
- `/risk?tab=monitoring` opens Monitoring; default is Register.
- A request detail page shows a "Requests" breadcrumb that returns to the list.
- `frontend_pages_summary.md` reads accurately.

- [ ] **Step 3: Commit any verification fixes**

```bash
git add -A
git commit -m "chore(sp4): verification fixes"
```

(Skip if none.)

---

## Self-review notes (author)

- **Spec coverage:** rename + Workspace label (T1), `/workflow` deep-link (T2), `/risk` deep-link (T3), requests/[id] breadcrumb (T4), doc refresh (T5), verification (T6). All spec §3 items map to a task.
- **Type consistency:** `changeTab(k)` defined and used within each page (T2 workflow `TabKey`, T3 risk `'register'|'monitoring'`); `VALID_TABS` typed as `TabKey[]`; risk reuses the already-declared `router` (T3 notes "do not re-declare").
- **No placeholders:** complete code for T1–T4; T5 is a documentation task with an explicit, enumerated correction list (not code). T6 names the exact fallback (Suspense wrap) if the build flags `useSearchParams`.
- **Frontend-only:** no backend/DB/permission/route changes; renaming the nav label leaves `href`/`visKey` intact.
