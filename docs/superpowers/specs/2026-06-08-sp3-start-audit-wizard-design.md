# SP3 — Start-Audit Guided Wizard — Design

> Status: Approved (design) · Date: 2026-06-08 · Branch: `sp3-start-audit-wizard`
> Author: Wole + Claude · Part of the IAMS frontend refinement programme (follows SP1, SP2)

---

## 1. Background & problem

Starting an audit and staffing it is the headline usability complaint. Today it spans two
pages and two disjoint dialogs:

1. `NewEngagementSlideOver` — one flat form: a tiny plan/ad-hoc toggle, plan/item or
   universe+type+priority+reason, title, three single user-selects (lead/manager/auditee),
   and three bare `type="date"` inputs with **no cross-field validation**. It only sets the
   lead/manager/auditee; it does not staff the supporting team.
2. The supporting team is assigned **elsewhere** — `ManageAssignmentsSlideOver` on the
   engagement detail page, reached only after the engagement exists.

So "start an audit and assign someone" requires creating the engagement on one screen and
then finding a different dialog on another screen. The ad-hoc entity picker is also a plain
`<select>` over up to 100 universe entries.

SP3 replaces the flat form with a guided **Start-Audit wizard** that folds team assignment
into the same flow, adds real validation and SLA prefill, makes "start an audit" a
first-class action, and shows the engagement's next step after creation. It builds on SP1's
primitives (`FormField` with `tooltip`/`description`, `InfoHint`, `statusMeaning()`) and the
existing skill-based assignment recommender.

### Key constraint that shapes the flow

The assignment recommender endpoint (`workflowApi.getCandidates(engagementId)`) is keyed by
**engagement id**, so skill-matched candidates can only be fetched **after** the engagement
exists. The wizard therefore creates the engagement at the Review step and then advances to
an Assign step that runs the recommender against the new engagement. This is **frontend-only**
— every endpoint it needs already exists:
- `engagementsApi.createFromPlan(dto)` / `engagementsApi.createAdhoc(dto)`
- `engagementsApi.updateStatus(id, 'in_progress')` (the "Start audit now" transition)
- `workflowApi.getCandidates(engagementId)` + `workflowApi.createAssignment({ engagementId, userId, role })`

### Market validation (carried from SP1)

TeamMate+/AuditBoard model the audit as a guided journey; TeamMate+'s main criticism is that
it is feature-dense and hard to learn. A guided, validated create-and-staff flow plus an
explicit "what's next" cue is the standard remedy.

---

## 2. Goals / non-goals

### Goals
- One guided wizard that **creates an engagement and staffs the team** in a single flow.
- Real **cross-field date validation** and **SLA prefill** (SLA defaults to the end date).
- A **searchable** entity picker for the ad-hoc scope step (replaces the 100-option select).
- Surface the engagement's **next required action** after creation (reusing SP1).
- Make **"Start audit"** a prominent, discoverable action (Home + Engagements list).

### Non-goals (out of scope)
- A transactional combined create+assign backend endpoint (approach B) — not needed.
- Any backend / API / schema change.
- A multi-select user primitive — the recommender already supports multi-assignment.
- Editing lifecycle gates, escalation/SLA policy values, or bulk engagement creation.
- Changing engagement business rules (statuses, plan-derived fields, permissions).

---

## 3. Architecture & units (all frontend, under `frontend/`)

| Unit | File | Responsibility |
|---|---|---|
| `Combobox` | `components/ui/Combobox.tsx` (+ `components/ui/index.ts` export) | searchable single-select primitive |
| `StartAuditWizard` | `components/audit/engagements/StartAuditWizard.tsx` (new) | 4-step create-and-assign slide-over |
| Engagements CTA | `app/(app)/audit/engagements/page.tsx` | "Start audit" button opens the wizard (replaces the `NewEngagementSlideOver` trigger) |
| Dashboard CTA | `app/(app)/dashboard/page.tsx` | "Start audit" entry point opening the wizard |
| Next-action nudge | `components/audit/engagements/OverviewTab.tsx` | shows `statusMeaning('engagement', status).next` |
| Remove | `components/audit/engagements/NewEngagementSlideOver.tsx` | superseded by the wizard; delete after callers repointed |

The wizard is the one larger unit; it owns step state and orchestrates the existing API
calls. The `Combobox` is a small, independently reusable primitive. Each has a clear,
testable boundary.

---

## 4. The wizard (`StartAuditWizard`)

A single `SlideOver` (width `xl`) with a step indicator header and footer Back/Next/primary
buttons. Internal `step` state (`1..4`); each step validates before advancing.

- **Step 1 — Scope.** A segmented control "From plan item" / "Ad-hoc" (replacing today's
  tiny text pills).
  - *Plan mode:* `Plan` select (approved plans) → `Plan item` select (un-rolled-over items);
    audit type/priority are derived by the backend from the plan item (unchanged).
  - *Ad-hoc mode:* `Entity` via the new **`Combobox`** (searchable over active universe
    entities), `Audit type`, `Priority`, `Ad-hoc reason`. Show the selected entity's
    **risk score** (from the universe list item) as context. SP1 tooltips on audit type and
    priority.
- **Step 2 — Team & Schedule.** `Lead auditor` / `Audit manager` / `Auditee` (existing
  `UserSelect`) + `Planned start` / `Planned end` / `SLA deadline` dates.
  - Validation: start required; `end ≥ start`; `SLA ≥ start`. **SLA prefills to the end
    date** whenever end changes and the user hasn't manually edited SLA.
  - SP1 field help on roles and SLA (carried from SP1's seeded copy).
- **Step 3 — Review.** Read-only summary (scope, team, schedule). Primary action **Create
  engagement** → `createFromPlan` (plan mode) or `createAdhoc` (ad-hoc mode). On success,
  capture the new engagement id and advance to step 4. On failure, stay on step 3 and toast
  the error.
- **Step 4 — Assign team.** Render the existing skill recommender against the new engagement:
  `getCandidates(newId)` ranked by audit-type skill match + workload (reuse the scoring logic
  currently inside `ManageAssignmentsSlideOver`). Each candidate → role select +
  `createAssignment`. Footer offers **"Start audit now"** (`updateStatus(id,'in_progress')`,
  then navigate to the engagement) and **"Finish"** (navigate without transitioning). The
  lead/manager/auditee chosen in step 2 are already on the engagement; step 4 adds the
  supporting team.

The skill-matching helpers (`AUDIT_TYPE_KEYWORDS`, `getMatchScore`, `isRelevantSkill`) are
currently private to `ManageAssignmentsSlideOver`. Extract them into a small shared module
`components/audit/engagements/assignment-matching.ts` so both the wizard's step 4 and the
existing `ManageAssignmentsSlideOver` import one implementation (DRY; no behavior change).

---

## 5. `Combobox` primitive

A searchable single-select, styled to match the existing custom `Select`:

```
interface ComboboxOption { value: string; label: string; hint?: string }
interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  emptyText?: string;   // shown when filter matches nothing
}
```

- Button shows the selected option's label (or placeholder); opening reveals a text input
  that filters `options` by case-insensitive label match, plus the filtered listbox.
- Accessible: `role="combobox"`/`listbox`/`option`, `aria-expanded`, arrow-key navigation,
  Enter to select, Escape to close, focus-visible ring (`ring-primary/40`), outside-click to
  close. `animate-fade-in motion-reduce:animate-none` for the panel.
- No new dependency — built with React + Tailwind tokens, mirroring `Select.tsx`.

---

## 6. Next-action nudge + Start-audit CTAs

- **Nudge:** in `OverviewTab.tsx`, render a compact banner using
  `statusMeaning('engagement', engagement.status)` (authored in SP1): show `.meaning` and,
  when present, **`Next: .next`**. This gives every engagement an explicit "what to do next"
  cue (e.g. *planned → "Assign the team and mark it in progress to begin."*). Read-only;
  no new endpoint.
- **CTAs:** a primary **"Start audit"** button in the Engagements list `PageHeader` actions
  (opening the wizard, replacing the old "New engagement" trigger), and a matching entry
  point on the dashboard (a button in the audit-summary area). Both are permission-gated the
  same way the current "New engagement" action is.

---

## 7. Data flow, errors, compatibility

- **Flow:** Steps 1-2 collect input (client state) → Step 3 creates the engagement (one API
  call) → Step 4 fetches candidates for the new id and assigns (N API calls) →
  optional status transition → navigate to the engagement detail.
- **Errors:** create failure → stay on Review with a toast. Per-candidate assignment failure
  → per-row toast; the engagement still exists and is reachable, so the user can Finish and
  use `ManageAssignmentsSlideOver` later. "Start audit now" failure → toast; the engagement
  remains `planned`.
- **Compatibility:** purely additive on the frontend. Removing `NewEngagementSlideOver` is
  safe once its only caller (the engagements list) uses the wizard. The existing
  `ManageAssignmentsSlideOver` keeps working (now importing the shared matching helpers).
  No backend/API/permission changes; abandoning the wizard mid-flow yields the same result
  as cancelling today's create form (before step 3) or a normal `planned` engagement
  (after step 3).

---

## 8. Verification

- **Frontend:** `npx tsc --noEmit` + `npm run build` pass.
- **Manual:**
  - Plan mode: pick an approved plan + item → team + schedule (SLA auto-fills to end) →
    review → create → assign a recommended auditor → "Start audit now" → lands on the
    engagement, now `in_progress`.
  - Ad-hoc mode: search the entity Combobox, fill type/priority/reason → through to create.
  - Date validation blocks `end < start`.
  - Engagement detail shows the next-action nudge for each status.
  - "Start audit" CTAs on Home + Engagements open the wizard.
  - `ManageAssignmentsSlideOver` still works (shared matching helpers).
- **Tech debt (unchanged):** no automated frontend tests; build + manual gates apply.

---

## 9. Roadmap context

- **SP1 — UI foundations & help layer** — merged.
- **SP2 — Template integration** — merged.
- **SP3 — Start-Audit guided wizard** (this doc).
- **SP4 — Navigation & IA clarity** — last; depends on SP1.
