# SP1 — UI Foundations & Help Layer — Design

> Status: Approved (design) · Date: 2026-06-08 · Branch: `sp1-ui-foundations`
> Author: Wole + Claude · Part of the IAMS frontend refinement programme

---

## 1. Background & problem

The IAMS frontend is functionally complete but the audit team reports it is hard to
understand and "the forms are mid." Investigation traced this to four root causes; SP1
addresses the two that are foundational and app-wide:

1. **No guidance layer.** There is currently **no tooltip component anywhere** in the
   frontend (`grep` for `Tooltip` returns nothing). `FormField` has a `hint` prop but no
   `(i)` affordance, and most forms never pass it. Nothing explains fields, statuses, or
   domain terms (risk bands, SLA, audit types, lifecycle).
2. **Inconsistent, dense form patterns.** Typography drops to `text-[9px]`/`text-[10px]`/
   `text-[11px]` in many places; "reject with a reason" is a polished modal in
   `ReportTab` but a raw `window.prompt()` in `WorkingPapersTab`; forms are flat stacks
   with no shared help conventions.

SP1 is the **enabling layer**: later sub-projects (SP2 template integration, SP3 the
Start-Audit wizard) both depend on a richer `FormField`, a `Tooltip`/`InfoHint` primitive,
and a standard reason dialog. Building SP1 first unblocks them and immediately improves
**every** form and page rather than one flow.

This design follows the existing `ui/` kit conventions (see `frontend/components/ui/`) and
is deliberately **additive and backward compatible** — no existing call site must change to
keep working, and there are **no backend changes**.

### Market validation (research)

- **TeamMate+** (Wolters Kluwer) models the audit journey explicitly; its most common user
  criticism is that it is feature-dense and slow to master — the same failure mode reported
  here. The cure is guidance (tooltips, inline help), not more screens.
- **AuditBoard** wins on collaboration and plain-language clarity.
- **IIA working-paper guidance** stresses standardized templates, explicit sign-off
  metadata, and work programs written so every team member understands the task. This
  reinforces the broader programme; SP1 lays the help/clarity groundwork it relies on.

---

## 2. Goals / non-goals

### Goals
- Ship an accessible `Tooltip` + `InfoHint` primitive (hover, keyboard focus, touch).
- Upgrade `FormField` with `tooltip`, `description`, `optional`, and a character counter —
  all optional, fully backward compatible.
- Provide one standard `ReasonDialog` and route all "reason then confirm" actions through
  it (delete the `window.prompt()`; replace the bespoke reject modal).
- Add status-meaning tooltips to `StatusBadge` via a central `statusMeaning()` map.
- Normalize typography (kill the `text-[9px/10px/11px]` overrides) in the shared `ui/`
  primitives and the in-scope flows; leave a tracked checklist for the rest.
- Seed real help content where it matters most (in-scope form fields, status badges, risk
  bands, nav items).

### Non-goals (deferred, NOT in SP1)
- Searchable combobox / multi-user-select primitives → **SP3** (where the wizard consumes
  them).
- Template pickers (working paper / report) → **SP2**.
- The Start-Audit guided wizard → **SP3**.
- Navigation route/label restructure beyond per-item description tooltips → **SP4**.
- Any backend, API, or schema change.
- Adding a frontend test framework (none exists today; tracked as tech debt below).

---

## 3. Components & interfaces

All paths are under `frontend/`.

### 3.1 `Tooltip` — `components/ui/Tooltip.tsx`
Thin styled wrapper over **`@radix-ui/react-tooltip`** (the only new dependency: headless,
small, correct focus/touch/collision behavior; styled with our existing tokens). Chosen over
a hand-rolled tooltip because positioning, collision avoidance, keyboard, and touch
dismissal are exactly what bespoke tooltips get wrong. It is isolated to this primitive and
does **not** touch the bespoke `Select`.

Interface:
```
interface TooltipProps {
  content: ReactNode;          // the help text/markup
  children: ReactElement;      // the trigger (must accept a ref)
  side?: 'top'|'right'|'bottom'|'left';   // default 'top'
  align?: 'start'|'center'|'end';          // default 'center'
  delayMs?: number;            // default 200
}
```
A single `TooltipProvider` is added once in `components/providers/Providers.tsx` so all
tooltips share timing config.

### 3.2 `InfoHint` — `components/ui/InfoHint.tsx`
The `(i)` / `?` icon affordance, wrapping `Tooltip`.
```
interface InfoHintProps {
  content: ReactNode;
  label?: string;              // accessible name; default "More information"
  icon?: 'info'|'help';        // default 'info' (lucide Info / HelpCircle)
  side?: TooltipProps['side'];
  className?: string;
}
```
Rendered as `<button type="button">` (focusable, never submits a form), `aria-label`
set from `label`, `text-text-muted` with a hover/focus color shift. Icon size `h-3.5 w-3.5`
to sit inline with labels.

### 3.3 `FormField` (upgrade) — `components/ui/FormField.tsx`
Backward-compatible superset of today's `label / htmlFor / required / error / hint`.

New shape:
```
interface FormFieldProps {
  label?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;              // renders a subtle "Optional" beside the label
  tooltip?: ReactNode;             // → <InfoHint> next to the label
  description?: ReactNode;         // always-visible helper UNDER the label (intent/why)
  hint?: ReactNode;                // helper UNDER the field (format/example) — as today
  error?: string;                  // replaces hint/counter visually when present — as today
  counter?: { value: string; max: number };  // live "X / max"; turns danger at/over max
  children: ReactNode;
  className?: string;
}
```
Visual order: **Label (i) · Optional** → *description* → `children` → (*error* | *hint*) ·
*counter*. The component auto-derives an `id` when `htmlFor` is absent and wires
`aria-describedby` to the description, hint, and error nodes. `required` and `optional` are
mutually exclusive (if both passed, `required` wins and we `console.warn` in dev).

Existing usages (which pass only `label/required/error/hint`) are unaffected.

### 3.4 `ReasonDialog` — `components/ui/ReasonDialog.tsx`
One modal for "capture a required reason, then confirm an action." Built on the existing
modal/overlay pattern used by `ConfirmDialog` and `ReportTab`'s reject modal.
```
interface ReasonDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  title: string;
  description?: ReactNode;
  reasonLabel?: string;            // default "Reason"
  placeholder?: string;
  confirmLabel?: string;           // default "Confirm"
  minLength?: number;              // default 1 (trimmed)
  tone?: 'default'|'danger';       // default 'default'; danger = red confirm
  isLoading?: boolean;
}
```
Confirm is disabled until the trimmed reason meets `minLength`. Used for: working-paper
reject, report reject, finding rejection, and any future reason-gated action.

### 3.5 `StatusBadge` (upgrade) — `components/ui/Badge.tsx`
Add an optional `tooltip?: ReactNode` to `StatusBadge`. When omitted, callers may opt in to
auto-help via a new `explain?: { entity: StatusEntity }` prop that looks up `statusMeaning()`.
Plain `Badge` is unchanged. Backward compatible: existing `<StatusBadge status=… />` calls
render exactly as before (no tooltip) unless `tooltip`/`explain` is supplied.

### 3.6 `statusMeaning()` — `lib/utils/status.ts`
Extends the existing `humanizeStatus()` helper. Central map keyed by entity + status:
```
type StatusEntity = 'engagement'|'finding'|'report'|'plan'|'working_paper'|'approval';
function statusMeaning(entity: StatusEntity, status: string): {
  label: string;        // humanized (reuses humanizeStatus)
  meaning: string;      // plain-English: what this status means
  next?: string;        // what unlocks the next state, if any
}
```
Single source of truth for status help text, consumed by `StatusBadge` tooltips and
reusable elsewhere (e.g. SP3 next-action stepper).

---

## 4. Typography normalization (bounded)

- **Scale:** inputs/labels `text-sm`; helper/description/counter `text-xs`; badges `text-xs`.
  Eliminate ad-hoc `text-[9px]`, `text-[10px]`, `text-[11px]` overrides.
- **Scope of the pass (bounded to avoid a 20-page churn):**
  1. Shared `ui/` primitives (`Input`, `Select`, `Textarea`, `Badge`, `FormField`,
     `Button` size variants).
  2. The in-scope flow components: `NewEngagementSlideOver`, `ManageAssignmentsSlideOver`,
     `WorkingPapersTab`, `ReportTab`.
- **Everything else:** captured as a checklist in the implementation plan (file + line of
  each remaining `text-[Npx]`), addressed opportunistically in later sub-projects — not
  forced in SP1.

---

## 5. Dialog standardization

- **Delete** the `window.prompt('Rejection reason')` at
  `components/audit/engagements/WorkingPapersTab.tsx` (~line 176); replace with
  `ReasonDialog` (`tone: 'danger'`).
- **Replace** the hand-rolled reject modal in `components/audit/engagements/ReportTab.tsx`
  with `ReasonDialog` so reject-with-reason is visually identical across the app.
- Any other `window.prompt`/`window.confirm` found during implementation is migrated to
  `ReasonDialog`/`ConfirmDialog` and listed in the plan.

---

## 6. Help content seeded in SP1

Building the primitive is half the value; seeding it is the other half.

- **Form fields (in-scope flows):** SLA deadline, ad-hoc reason, audit-type definitions,
  lead/manager/auditee role meanings, working-paper section purpose.
- **Status badges (app-wide):** every engagement / finding / report / plan / working-paper /
  approval status gets `meaning` + `next` via `statusMeaning()`.
- **Risk score bands:** Critical 20–25 / High 13–19 / Medium 6–12 / Low 1–5 (currently only
  encoded in the backend, never explained to users).
- **Nav items:** a one-line description tooltip per page in `components/layout/Sidebar.tsx`
  (also begins to address the "page distinction" complaint ahead of SP4).

Help copy lives next to its consumer (or in `lib/utils/status.ts` for statuses), not in a
monolithic strings file, to keep units self-contained.

---

## 7. Data flow, errors, dependencies

- **Data flow:** none new. SP1 is purely presentational; no network, no state beyond local
  component state in `ReasonDialog`.
- **Error handling:** `ReasonDialog` surfaces async `onConfirm` rejections via the caller's
  existing `toast` pattern (caller owns the mutation); the dialog only guards empty/short
  input and the loading state.
- **New dependency:** `@radix-ui/react-tooltip` only. No other libraries. The bespoke
  `Select` and all other primitives are untouched.

---

## 8. Compatibility & risk

- Every change is **additive**; no existing `FormField`/`StatusBadge`/dialog call site needs
  editing to keep working.
- No backend, API, or schema changes — zero server risk.
- Largest risk is visual regression from the typography pass; mitigated by bounding the pass
  to shared primitives + four in-scope components and verifying via build + manual review.

---

## 9. Verification

- `npm run build` (Next/TypeScript) passes with no new type errors.
- Manual checks:
  - Tooltip shows on mouse hover, on keyboard focus (Tab to the `(i)`), and dismisses on
    Escape/blur; readable on a narrow viewport (collision handling).
  - `InfoHint` inside a form does not submit the form when activated.
  - The four in-scope forms render with the new typography and no `text-[Npx]` remnants.
  - Working-paper and report rejection both go through `ReasonDialog` and block empty
    reasons.
  - Existing forms that were not edited still render identically.
- **Tech debt (out of scope, tracked):** the frontend has no automated test framework;
  SP1 adds none. Recommend introducing component tests in a later cycle.

---

## 10. Sub-project roadmap (context)

SP1 is first of four; each gets its own spec → plan → build cycle:

- **SP1 — UI foundations & help layer** (this doc).
- **SP2 — Template integration:** working-paper template *picker* (not just the silent
  default), structured WP view/edit (fixes the raw-JSON display bug), report template
  selector + template-driven preview/branding. Depends on SP1.
- **SP3 — Start-Audit guided wizard:** multi-step create-and-assign, SLA prefill,
  next-action stepper, "Start audit" CTAs; introduces combobox / multi-user-select. Small
  additive backend changes. Depends on SP1.
- **SP4 — Navigation & IA clarity:** nav label/route alignment, descriptions, doc refresh.
  Depends on SP1.
