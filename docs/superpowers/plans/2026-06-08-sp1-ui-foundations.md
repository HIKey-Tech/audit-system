# SP1 — UI Foundations & Help Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accessible help layer (Tooltip / InfoHint), a richer `FormField`, a standard `ReasonDialog`, status-meaning tooltips, and a bounded typography cleanup — all additive and backward compatible, with no backend changes.

**Architecture:** Pure presentational additions to the existing `frontend/components/ui/` kit, styled with the app's existing Tailwind tokens (primary `#008751`, `surface/border/text` scales, `fade-in` animation). One new dependency: `@radix-ui/react-tooltip`, isolated to the new `Tooltip` primitive. Help content is seeded next to its consumer; status help lives in `lib/utils/status.ts`.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, `@radix-ui/react-tooltip`, `lucide-react`, `sonner`.

**Design direction (from ui-ux-pro-max + a11y rules):** dark tooltip (`#1A202C` bg / white text, `text-xs`, arrow); InfoHint = focusable `type="button"` icon (`h-3.5 w-3.5`, `text-text-muted`); errors use `role="alert"`; icon-only buttons get `aria-label`; never remove an outline without a `focus-visible` ring (match Button: `ring-2 ring-primary/40 ring-offset-2`); convey state with text+icon, not color alone; respect `prefers-reduced-motion`.

**Working directory:** all paths are under `frontend/`. Run commands from `frontend/` unless stated.

**Per-task verification (no unit-test runner exists in this frontend):**
- Type gate: `npx tsc --noEmit` (run from `frontend/`) — expected: no errors.
- Final gate (last task): `npm run build` — expected: build succeeds.
- Plus the explicit manual checks listed in each task.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `frontend/package.json` | modify | add `@radix-ui/react-tooltip` |
| `frontend/components/providers/Providers.tsx` | modify | mount one `TooltipProvider` |
| `frontend/components/ui/Tooltip.tsx` | create | styled Radix tooltip primitive |
| `frontend/components/ui/InfoHint.tsx` | create | inline `(i)` help icon button |
| `frontend/components/ui/ReasonDialog.tsx` | create | standard reason-capture modal |
| `frontend/components/ui/FormField.tsx` | rewrite | richer field wrapper (tooltip/description/optional/counter/a11y) |
| `frontend/components/ui/Badge.tsx` | modify | `StatusBadge` gains `tooltip`/`explain` |
| `frontend/lib/utils/status.ts` | modify | add `StatusEntity` + `statusMeaning()` |
| `frontend/components/ui/index.ts` | modify | export `Tooltip`, `InfoHint`, `ReasonDialog` |
| `frontend/components/audit/engagements/WorkingPapersTab.tsx` | modify | replace `window.prompt` reject with `ReasonDialog`; seed field tooltips |
| `frontend/components/audit/engagements/ReportTab.tsx` | modify | replace bespoke reject modal with `ReasonDialog` |
| `frontend/components/audit/engagements/NewEngagementSlideOver.tsx` | modify | seed field tooltips/descriptions; typography |
| `frontend/components/audit/engagements/ManageAssignmentsSlideOver.tsx` | modify | typography normalization |
| `frontend/components/layout/Sidebar.tsx` | modify | per-nav-item description tooltips |
| `docs/superpowers/plans/2026-06-08-sp1-remaining-typography.md` | create | tracked checklist of remaining `text-[Npx]` offenders |

---

## Task 1: Add Radix tooltip dependency + TooltipProvider

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/components/providers/Providers.tsx`

- [ ] **Step 1: Install the dependency**

Run (from `frontend/`):
```bash
npm install @radix-ui/react-tooltip@^1.1.0
```
Expected: `package.json` + `package-lock.json` updated, no peer-dep errors (React 18 is compatible).

- [ ] **Step 2: Mount a single TooltipProvider**

Edit `frontend/components/providers/Providers.tsx`. Add the import and wrap `children`:

```tsx
'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import * as RadixTooltip from '@radix-ui/react-tooltip';

export const Providers = ({ children }: { children: ReactNode }): JSX.Element => {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              if (error instanceof Error && error.message.toLowerCase().includes('session expired')) {
                return false;
              }
              return failureCount < 1;
            },
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <RadixTooltip.Provider delayDuration={200} skipDelayDuration={300}>
        {children}
      </RadixTooltip.Provider>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            fontFamily: 'var(--font-inter)',
            fontSize: '13px',
          },
        }}
      />
    </QueryClientProvider>
  );
};
```

- [ ] **Step 3: Type gate**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/components/providers/Providers.tsx
git commit -m "feat(ui): add radix tooltip dependency and TooltipProvider"
```

---

## Task 2: Tooltip primitive

**Files:**
- Create: `frontend/components/ui/Tooltip.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { ReactElement, ReactNode } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils/cn';

interface TooltipProps {
  /** Help content. If empty/nullish, the trigger renders without a tooltip. */
  content: ReactNode;
  /** Single trigger element; must forward ref + props (DOM element or forwardRef component). */
  children: ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** Override per-tooltip open delay (ms). */
  delayMs?: number;
  className?: string;
}

export const Tooltip = ({
  content,
  children,
  side = 'top',
  align = 'center',
  delayMs,
  className,
}: TooltipProps): JSX.Element => {
  if (content === null || content === undefined || content === '') {
    return <>{children}</>;
  }

  return (
    <RadixTooltip.Root delayDuration={delayMs}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            'z-50 max-w-xs rounded-md bg-[#1A202C] px-2.5 py-1.5 text-xs font-medium leading-snug text-white shadow-card-hover',
            'animate-fade-in motion-reduce:animate-none',
            className,
          )}
        >
          {content}
          <RadixTooltip.Arrow className="fill-[#1A202C]" width={10} height={5} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
};
```

- [ ] **Step 2: Type gate**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/ui/Tooltip.tsx
git commit -m "feat(ui): add Tooltip primitive (radix-based)"
```

---

## Task 3: InfoHint icon button

**Files:**
- Create: `frontend/components/ui/InfoHint.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { ReactNode } from 'react';
import { Info, HelpCircle } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { cn } from '@/lib/utils/cn';

interface InfoHintProps {
  content: ReactNode;
  /** Accessible name for the icon button. */
  label?: string;
  icon?: 'info' | 'help';
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export const InfoHint = ({
  content,
  label = 'More information',
  icon = 'info',
  side = 'top',
  className,
}: InfoHintProps): JSX.Element => {
  const Icon = icon === 'help' ? HelpCircle : Info;
  return (
    <Tooltip content={content} side={side}>
      <button
        type="button"
        aria-label={label}
        className={cn(
          'inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full text-text-muted transition-colors',
          'hover:text-text-secondary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1',
          className,
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </button>
    </Tooltip>
  );
};
```

- [ ] **Step 2: Type gate**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/ui/InfoHint.tsx
git commit -m "feat(ui): add InfoHint help-icon button"
```

---

## Task 4: ReasonDialog modal

**Files:**
- Create: `frontend/components/ui/ReasonDialog.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils/cn';

interface ReasonDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  title: string;
  description?: ReactNode;
  reasonLabel?: string;
  placeholder?: string;
  confirmLabel?: string;
  /** Minimum trimmed length required to enable confirm. */
  minLength?: number;
  tone?: 'default' | 'danger';
  isLoading?: boolean;
}

export const ReasonDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  reasonLabel = 'Reason',
  placeholder,
  confirmLabel = 'Confirm',
  minLength = 1,
  tone = 'default',
  isLoading = false,
}: ReasonDialogProps): JSX.Element | null => {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const inputId = `${baseId}-input`;
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset + focus when opened.
  useEffect(() => {
    if (!open) return;
    setReason('');
    const id = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  // Escape to close (unless mid-flight).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, isLoading, onClose]);

  if (!open) return null;

  const trimmed = reason.trim();
  const valid = trimmed.length >= minLength;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in motion-reduce:animate-none"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={() => !isLoading && onClose()}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-lg border border-border bg-white p-5 shadow-card-hover">
        <div className="flex items-start gap-3">
          {tone === 'danger' && (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-danger">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-text-primary">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-xs text-text-secondary">{description}</p>
            )}
            <div className="mt-3">
              <label htmlFor={inputId} className="sr-only">
                {reasonLabel}
              </label>
              <textarea
                id={inputId}
                ref={textareaRef}
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={placeholder}
                disabled={isLoading}
                className={cn(
                  'w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-muted',
                  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
                  'disabled:cursor-not-allowed disabled:bg-surface',
                )}
              />
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={() => {
              if (valid) void onConfirm(trimmed);
            }}
            isLoading={isLoading}
            disabled={!valid}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Type gate**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/ui/ReasonDialog.tsx
git commit -m "feat(ui): add standard ReasonDialog modal"
```

---

## Task 5: `statusMeaning()` map

**Files:**
- Modify: `frontend/lib/utils/status.ts` (append; do not change existing exports)

- [ ] **Step 1: Append the entity type, map, and function**

Add at the END of `frontend/lib/utils/status.ts` (after `riskScoreLabel`):

```ts
export type StatusEntity =
  | 'engagement'
  | 'finding'
  | 'report'
  | 'plan'
  | 'working_paper'
  | 'approval';

export interface StatusMeaning {
  label: string;   // humanized status
  meaning: string; // what this status means, plain English
  next?: string;   // what advances it to the next state
}

// entity -> normalized status key -> meaning. Keys are lower_snake_case.
const STATUS_MEANINGS: Record<StatusEntity, Record<string, Omit<StatusMeaning, 'label'>>> = {
  engagement: {
    planned: { meaning: 'Scheduled but fieldwork has not started.', next: 'Assign the team and mark it in progress to begin.' },
    in_progress: { meaning: 'Fieldwork is underway; working papers and evidence are being captured.', next: 'Complete checklists and get working papers approved to move to review.' },
    under_review: { meaning: 'Fieldwork is done and the work is being reviewed.', next: 'Generate and issue the report to move to reported.' },
    reported: { meaning: 'The audit report has been issued to stakeholders.', next: 'Verify and close all findings to close the engagement.' },
    closed: { meaning: 'The engagement is complete and all findings are resolved.' },
  },
  finding: {
    open: { meaning: 'Raised and awaiting a management response.', next: 'Record the management response.' },
    management_response_received: { meaning: 'Management has responded with a remediation plan.', next: 'Begin remediation.' },
    in_remediation: { meaning: 'Corrective action is in progress.', next: 'Submit remediation evidence for verification.' },
    verified: { meaning: 'Remediation evidence has been verified by audit.', next: 'Close the finding.' },
    closed: { meaning: 'The finding is fully resolved and closed.' },
  },
  report: {
    draft: { meaning: 'Being prepared; not yet submitted.', next: 'Submit for approval.' },
    submitted: { meaning: 'Submitted and awaiting approval.', next: 'Approver acts on the current level.' },
    approved: { meaning: 'Approved through all levels but not yet issued.', next: 'Issue the report.' },
    rejected: { meaning: 'Sent back by an approver with a reason.', next: 'Address the reason and resubmit.' },
    issued: { meaning: 'Finalised and distributed to stakeholders.' },
  },
  plan: {
    draft: { meaning: 'Being assembled; items can still be added.', next: 'Submit for approval.' },
    submitted: { meaning: 'Submitted and awaiting approval.', next: 'Approver reviews the plan.' },
    approved: { meaning: 'Approved; engagements can be created from its items.', next: 'Create engagements from plan items.' },
    rejected: { meaning: 'Returned by an approver with a reason.', next: 'Revise and resubmit.' },
  },
  working_paper: {
    draft: { meaning: 'Editable; not yet submitted for review.', next: 'Submit for review.' },
    submitted: { meaning: 'Awaiting reviewer approval.', next: 'Reviewer approves or rejects.' },
    approved: { meaning: 'Reviewed and locked.' },
    rejected: { meaning: 'Returned by the reviewer with a comment.', next: 'Address the comment and resubmit.' },
  },
  approval: {
    pending: { meaning: 'Awaiting a decision at the current level.', next: 'The current-level approver acts.' },
    approved: { meaning: 'Approved at this level / overall.' },
    rejected: { meaning: 'Rejected with a reason.' },
    cancelled: { meaning: 'The approval request was cancelled.' },
  },
};

export const statusMeaning = (
  entity: StatusEntity,
  status: string | null | undefined,
): StatusMeaning => {
  const label = humanizeStatus(status);
  if (!status) return { label, meaning: 'No status set.' };
  const key = status.toLowerCase().replace(/\s+/g, '_');
  const found = STATUS_MEANINGS[entity]?.[key];
  return found ? { label, ...found } : { label, meaning: label };
};
```

- [ ] **Step 2: Type gate**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/utils/status.ts
git commit -m "feat(status): add statusMeaning() help map"
```

---

## Task 6: Upgrade `FormField` (backward compatible)

**Files:**
- Rewrite: `frontend/components/ui/FormField.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { Children, ReactElement, ReactNode, cloneElement, isValidElement, useId } from 'react';
import { cn } from '@/lib/utils/cn';
import { InfoHint } from './InfoHint';

interface FormFieldProps {
  label?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  /** Renders a subtle "Optional" affordance. Ignored if `required` is set. */
  optional?: boolean;
  /** Help shown via an (i) icon next to the label. */
  tooltip?: ReactNode;
  /** Always-visible helper UNDER the label (intent / why). */
  description?: ReactNode;
  /** Helper UNDER the field (format / example). Hidden when `error` is present. */
  hint?: ReactNode;
  error?: string;
  /** Live "X / max" counter; turns danger at or over max. */
  counter?: { value: string; max: number };
  children: ReactNode;
  className?: string;
}

export const FormField = ({
  label,
  htmlFor,
  required,
  optional,
  tooltip,
  description,
  hint,
  error,
  counter,
  children,
  className,
}: FormFieldProps): JSX.Element => {
  const autoId = useId();
  const descId = description ? `${autoId}-desc` : undefined;
  const msgId = error || hint ? `${autoId}-msg` : undefined;
  const describedBy = [descId, msgId].filter(Boolean).join(' ') || undefined;

  // Best-effort: wire aria-describedby onto a single element child.
  const child = (() => {
    if (!describedBy) return children;
    const arr = Children.toArray(children);
    if (arr.length === 1 && isValidElement(arr[0])) {
      const el = arr[0] as ReactElement<{ 'aria-describedby'?: string }>;
      const existing = el.props['aria-describedby'];
      return cloneElement(el, {
        'aria-describedby': existing ? `${existing} ${describedBy}` : describedBy,
      });
    }
    return children;
  })();

  const overLimit = counter ? counter.value.length >= counter.max : false;

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={htmlFor} className="flex items-center gap-1 text-sm font-medium text-text-primary">
            <span>
              {label}
              {required && <span className="ml-0.5 text-danger">*</span>}
            </span>
            {tooltip && <InfoHint content={tooltip} />}
          </label>
          {optional && !required && (
            <span className="text-xs text-text-muted">Optional</span>
          )}
        </div>
      )}

      {description && (
        <p id={descId} className="text-xs text-text-secondary">
          {description}
        </p>
      )}

      {child}

      {(error || hint || counter) && (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {error ? (
              <p id={msgId} role="alert" className="text-xs text-danger">
                {error}
              </p>
            ) : hint ? (
              <p id={msgId} className="text-xs text-text-muted">
                {hint}
              </p>
            ) : null}
          </div>
          {counter && (
            <span
              className={cn(
                'shrink-0 text-xs tabular-nums',
                overLimit ? 'font-semibold text-danger' : 'text-text-muted',
              )}
            >
              {counter.value.length} / {counter.max}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Type gate**

Run: `npx tsc --noEmit`
Expected: no errors. (All existing call sites pass only `label/required/error/hint`, which still type-check.)

- [ ] **Step 3: Manual check**

Run `npm run dev`, open any form (e.g. `/audit/plans` → "New plan"). Expected: existing fields render unchanged (label/error/hint as before). The label text is now `text-sm`.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/FormField.tsx
git commit -m "feat(ui): richer FormField (tooltip, description, optional, counter, a11y)"
```

---

## Task 7: `StatusBadge` gains optional help tooltip

**Files:**
- Modify: `frontend/components/ui/Badge.tsx`

- [ ] **Step 1: Replace the `StatusBadge` export (leave `Badge` untouched)**

At the top of `frontend/components/ui/Badge.tsx`, update imports:

```tsx
import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { statusTone, humanizeStatus, statusMeaning, type StatusEntity } from '@/lib/utils/status';
import { Tooltip } from './Tooltip';
```

Then replace the existing `StatusBadge` definition (the `export const StatusBadge = …` block at the bottom) with:

```tsx
export const StatusBadge = ({
  status,
  size,
  withDot,
  className,
  tooltip,
  explain,
}: {
  status: string | null | undefined;
  size?: 'xs' | 'sm';
  withDot?: boolean;
  className?: string;
  /** Explicit tooltip content. Takes precedence over `explain`. */
  tooltip?: ReactNode;
  /** Auto-generate a meaning + next-step tooltip for this entity's status. */
  explain?: StatusEntity;
}): JSX.Element => {
  const badge = (
    <Badge status={status ?? undefined} size={size} withDot={withDot} className={className} />
  );

  let content: ReactNode = tooltip ?? null;
  if (!content && explain && status) {
    const m = statusMeaning(explain, status);
    content = (
      <span className="block">
        <span className="font-semibold">{m.label}</span>
        <span className="mt-0.5 block font-normal text-white/90">{m.meaning}</span>
        {m.next && (
          <span className="mt-1 block font-normal text-white/70">Next: {m.next}</span>
        )}
      </span>
    );
  }

  if (!content) return badge;

  return (
    <Tooltip content={content}>
      <span className="inline-flex cursor-help">{badge}</span>
    </Tooltip>
  );
};
```

- [ ] **Step 2: Type gate**

Run: `npx tsc --noEmit`
Expected: no errors. (Existing `<StatusBadge status=… />` calls omit `tooltip`/`explain` and render exactly as before — no tooltip.)

- [ ] **Step 3: Commit**

```bash
git add frontend/components/ui/Badge.tsx
git commit -m "feat(ui): StatusBadge optional status-meaning tooltip"
```

---

## Task 8: Export the new primitives

**Files:**
- Modify: `frontend/components/ui/index.ts`

- [ ] **Step 1: Add exports**

Add these three lines to `frontend/components/ui/index.ts` (after the `SlideOver` export):

```ts
export { Tooltip } from './Tooltip';
export { InfoHint } from './InfoHint';
export { ReasonDialog } from './ReasonDialog';
```

- [ ] **Step 2: Type gate**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/ui/index.ts
git commit -m "chore(ui): export Tooltip, InfoHint, ReasonDialog"
```

---

## Task 9: Replace `window.prompt` reject in WorkingPapersTab with ReasonDialog

**Files:**
- Modify: `frontend/components/audit/engagements/WorkingPapersTab.tsx`

Context: the working-paper list has a "Reject" button (~line 170-182) that currently calls `window.prompt('Rejection reason')`. The `rejectMut` mutation already takes `{ id, reason }`.

- [ ] **Step 1: Import ReasonDialog and add reject state**

In the import block at the top, add `ReasonDialog`:

```tsx
import { ReasonDialog } from '@/components/ui/ReasonDialog';
```

Inside the `WorkingPapersTab` component, alongside the existing `useState` hooks (`createOpen`, `importOpen`, `editing`), add:

```tsx
const [rejecting, setRejecting] = useState<AuditWorkingPaper | null>(null);
```

- [ ] **Step 2: Swap the Reject button handler**

Replace the existing Reject `<Button>` (the one whose `onClick` uses `window.prompt`) with:

```tsx
{canRejectWP && (
  <Button
    size="sm"
    variant="danger"
    leftIcon={<X className="h-3.5 w-3.5" />}
    onClick={() => setRejecting(wp)}
  >
    Reject
  </Button>
)}
```

- [ ] **Step 3: Render the dialog**

Just before the closing `</div>` that wraps the tab (next to the other slide-overs `<CreateOrEditPaperSlideOver … />`, `<ImportPaperSlideOver … />`, `<ViewPaperSlideOver … />`), add:

```tsx
<ReasonDialog
  open={Boolean(rejecting)}
  onClose={() => setRejecting(null)}
  onConfirm={async (reason) => {
    if (!rejecting) return;
    await rejectMut.mutateAsync({ id: rejecting.id, reason });
    setRejecting(null);
  }}
  title="Reject working paper"
  description="Provide a reason. It is recorded on the working paper and visible to the preparer."
  placeholder="Reason for rejection…"
  confirmLabel="Reject"
  tone="danger"
  isLoading={rejectMut.isPending}
/>
```

- [ ] **Step 4: Type gate**

Run: `npx tsc --noEmit`
Expected: no errors. (`rejectMut` from `useMutation` exposes `mutateAsync` and `isPending`.)

- [ ] **Step 5: Manual check**

Run `npm run dev`, open an engagement with a `submitted` working paper as a reviewer, click Reject. Expected: the standard dialog opens; Confirm is disabled until a reason is typed; rejecting shows the loading state and closes on success.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/audit/engagements/WorkingPapersTab.tsx
git commit -m "refactor(audit): use ReasonDialog for working-paper rejection (remove window.prompt)"
```

---

## Task 10: Replace bespoke reject modal in ReportTab with ReasonDialog

**Files:**
- Modify: `frontend/components/audit/engagements/ReportTab.tsx`

Context: ReportTab has a hand-rolled rejection modal driven by `isRejectModalOpen` / `rejectReasonText` and `rejectMut`.

- [ ] **Step 1: Import ReasonDialog**

Add to the import block:

```tsx
import { ReasonDialog } from '@/components/ui/ReasonDialog';
```

- [ ] **Step 2: Remove the `rejectReasonText` state**

Delete this line (the dialog now owns the text):

```tsx
const [rejectReasonText, setRejectReasonText] = useState('');
```

Keep `const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);`.

- [ ] **Step 3: Simplify the Reject trigger**

Replace the Reject `<Button>` `onClick` body so it no longer resets text:

```tsx
{canRejectApproval && (
  <Button variant="danger" size="sm" leftIcon={<X className="h-4 w-4" />} onClick={() => setIsRejectModalOpen(true)}>
    Reject
  </Button>
)}
```

- [ ] **Step 4: Replace the entire custom modal block**

Delete the whole `{isRejectModalOpen && ( <div className="fixed inset-0 z-50 …"> … </div> )}` block at the bottom of the component and replace it with:

```tsx
<ReasonDialog
  open={isRejectModalOpen}
  onClose={() => setIsRejectModalOpen(false)}
  onConfirm={async (reason) => {
    await rejectMut.mutateAsync(reason);
    setIsRejectModalOpen(false);
  }}
  title="Reject audit report"
  description="Provide a detailed reason for rejecting this report. This feedback is visible in the approval chain logs."
  placeholder="Enter reason for rejection…"
  confirmLabel="Confirm rejection"
  tone="danger"
  isLoading={rejectMut.isPending}
/>
```

- [ ] **Step 5: Type gate**

Run: `npx tsc --noEmit`
Expected: no errors. If `useState` is now unused elsewhere it still stays imported (other hooks use it). `rejectMut.mutateAsync` is available from `useMutation`.

- [ ] **Step 6: Manual check**

Run `npm run dev`, open a `submitted` report as the current approver, click Reject. Expected: identical dialog to the working-paper reject; empty reason blocks confirm; success closes the dialog.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/audit/engagements/ReportTab.tsx
git commit -m "refactor(audit): use shared ReasonDialog for report rejection"
```

---

## Task 11: Seed help on the New Engagement form

**Files:**
- Modify: `frontend/components/audit/engagements/NewEngagementSlideOver.tsx`

- [ ] **Step 1: Add `tooltip`/`description` to key fields**

These fields already use `<FormField label=… required …>`. Add the new props (no other logic changes). Apply exactly:

- Audit type field → add:
  ```tsx
  tooltip="IT: infrastructure & cybersecurity (ISO 27001/22301). Financial: transactions & controls. Compliance: ISO/NDPR adherence. Systems: configuration, change & continuity."
  ```
- Priority field → add:
  ```tsx
  tooltip="Drives scheduling and SLA expectations. Critical/High engagements escalate faster when overdue."
  ```
- Ad-hoc reason field → add:
  ```tsx
  description="Required for audits outside the approved annual plan — explains the trigger (e.g. incident, management request)."
  ```
- Lead auditor field → add:
  ```tsx
  tooltip="Owns fieldwork and day-to-day execution of the engagement."
  ```
- Audit manager field → add:
  ```tsx
  tooltip="Reviews and signs off the lead auditor's work."
  ```
- Auditee field → add:
  ```tsx
  tooltip="Primary contact in the audited area who provides evidence and management responses."
  ```
- SLA deadline field → add:
  ```tsx
  tooltip="Target completion date. Breaching it triggers the escalation workflow."
  ```

Example of the resulting Audit type field:

```tsx
<FormField
  label="Audit type"
  required
  error={errors.auditType?.message}
  tooltip="IT: infrastructure & cybersecurity (ISO 27001/22301). Financial: transactions & controls. Compliance: ISO/NDPR adherence. Systems: configuration, change & continuity."
>
  <Select {...register('auditType')}>
    <option value="it">IT</option>
    <option value="financial">Financial</option>
    <option value="compliance">Compliance</option>
    <option value="systems">Systems</option>
  </Select>
</FormField>
```

- [ ] **Step 2: Type gate**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual check**

Open `/audit/engagements` → "New engagement". Expected: an `(i)` appears next to the named labels; hovering/focusing shows the help; the ad-hoc reason field shows its description line above the textarea.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/audit/engagements/NewEngagementSlideOver.tsx
git commit -m "feat(audit): seed field help on the new-engagement form"
```

---

## Task 12: Seed status help + nav descriptions + risk-band help

**Files:**
- Modify: `frontend/components/audit/engagements/WorkingPapersTab.tsx` (status badge)
- Modify: `frontend/components/audit/engagements/ReportTab.tsx` (status badge)
- Modify: `frontend/components/layout/Sidebar.tsx` (nav item tooltips)

- [ ] **Step 1: Add `explain` to in-scope status badges**

In `WorkingPapersTab.tsx`, the working-paper row renders `<StatusBadge status={wp.status} />`. Change to:

```tsx
<StatusBadge status={wp.status} explain="working_paper" />
```

In `ReportTab.tsx`, the report header renders `<StatusBadge status={r.status} />`. Change to:

```tsx
<StatusBadge status={r.status} explain="report" />
```

- [ ] **Step 2: Add nav description tooltips to the sidebar**

In `frontend/components/layout/Sidebar.tsx`, extend the `NavLink` interface with an optional `description`:

```tsx
interface NavLink {
  type: 'link';
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  badgeKey?: 'notifications';
  comingSoon?: boolean;
  matchPrefix?: string;
  visKey?: keyof NavVisibility;
  description?: string;
}
```

Add a `description` to each link in the `NAV` array (exact copy):

```
Home:           'Your personalized overview and to-dos.'
Approvals:      'Items awaiting your approval, plus assignments and escalations.'
Requests:       'Information and evidence requests to and from auditees.'
Engagements:    'Active and past audit engagements you can run end to end.'
Findings:       'Issues raised across audits, with severity and remediation status.'
Notifications:  'System and workflow alerts addressed to you.'
Audit Plans:    'Annual risk-based audit plans and their approval status.'
Audit Universe: 'Registry of auditable entities and their risk scores.'
Reports:        'Issued and in-progress audit reports.'
Risk Register:  'Enterprise risks with likelihood × impact scoring.'
Documents:      'Files and evidence attached to audit records.'
Analytics:      'Dashboards and metrics on the audit programme.'
Audit Logs:     'Tamper-evident trail of every action in the system.'
Users:          'User accounts, roles, and permissions.'
Settings:       'Templates, roles, and system configuration.'
```

Then wrap the nav `<Link>` with a `Tooltip` (only when expanded — when collapsed the existing `title` attribute already covers it; the new tooltip gives richer help when expanded). Import at top:

```tsx
import { Tooltip } from '@/components/ui/Tooltip';
```

Wrap the rendered `<Link>` for link items:

```tsx
<Tooltip content={item.description} side="right">
  <Link
    href={item.href}
    /* …existing className/title/children unchanged… */
  >
    {/* …existing children… */}
  </Link>
</Tooltip>
```

(`Tooltip` no-ops when `item.description` is undefined, so dividers and description-less links are unaffected.)

- [ ] **Step 3: Type gate**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run `npm run dev`. Expected: hovering a sidebar item shows its description to the right; a working-paper / report status badge shows "meaning + next" on hover.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/audit/engagements/WorkingPapersTab.tsx frontend/components/audit/engagements/ReportTab.tsx frontend/components/layout/Sidebar.tsx
git commit -m "feat(ui): seed status-meaning and nav-description tooltips"
```

---

## Task 13: Bounded typography normalization

**Files:**
- Modify: `frontend/components/ui/Badge.tsx`
- Modify: `frontend/components/audit/engagements/ManageAssignmentsSlideOver.tsx`
- Create: `docs/superpowers/plans/2026-06-08-sp1-remaining-typography.md`

Rule for this pass: **no font smaller than `text-[11px]`; prefer `text-xs`** for helper/label text. Only touch the files in this task; everything else goes on the tracked checklist.

- [ ] **Step 1: Fix the `Badge` micro size**

In `frontend/components/ui/Badge.tsx`, the size classes use `text-[11px]` for `xs`. Replace:

```tsx
size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
```
with:
```tsx
size === 'xs' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
```

- [ ] **Step 2: Normalize ManageAssignmentsSlideOver typography**

In `frontend/components/audit/engagements/ManageAssignmentsSlideOver.tsx`, apply these class replacements (use editor find/replace within this file only):

- `text-[9px]` → `text-[11px]`
- `text-[10px]` → `text-[11px]`
- `text-[11px]` → `text-xs`

After replacing, visually confirm the candidate cards still fit (the three-column grid). If any badge/tag wraps awkwardly, keep `text-[11px]` for that specific element instead of `text-xs`.

- [ ] **Step 3: Record the remaining offenders**

Run (from repo root `audit-system/`) to list every remaining tiny-font usage across the frontend:

```bash
grep -rnE "text-\[(9|10|11)px\]" frontend/app frontend/components | grep -v "ManageAssignmentsSlideOver" > /tmp/typo.txt; wc -l /tmp/typo.txt
```

Create `docs/superpowers/plans/2026-06-08-sp1-remaining-typography.md` with this content (paste the grep output into the list):

```markdown
# SP1 follow-up — remaining typography offenders

Out of SP1's bounded scope. Each line is a `text-[9px]/[10px]/[11px]` usage to
normalize (min `text-[11px]`, prefer `text-xs`) opportunistically during SP2–SP4
when the owning component is next touched.

<!-- paste `grep -rnE "text-\[(9|10|11)px\]" frontend/app frontend/components` output here -->
```

- [ ] **Step 4: Type gate + visual check**

Run: `npx tsc --noEmit` → no errors.
Run `npm run dev`, open an engagement → "Manage assignments". Expected: text is noticeably more readable; layout intact.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/ui/Badge.tsx frontend/components/audit/engagements/ManageAssignmentsSlideOver.tsx docs/superpowers/plans/2026-06-08-sp1-remaining-typography.md
git commit -m "style(ui): normalize typography in shared primitives + assignments; track the rest"
```

---

## Task 14: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full type + build gate**

Run (from `frontend/`):
```bash
npx tsc --noEmit && npm run build
```
Expected: type check clean; Next.js production build succeeds.

- [ ] **Step 2: Manual smoke pass**

Run `npm run dev` and verify:
- Tooltip: hover AND keyboard-focus (Tab to an `(i)`) both show help; Escape/blur dismisses; readable on a narrow window (collision flips side).
- InfoHint inside the New Engagement form does NOT submit the form when clicked/Enter.
- Reject flows (working paper + report) both use the identical `ReasonDialog`; empty reason blocks confirm; loading state shows.
- An untouched form (e.g. New Plan) still renders correctly.
- Sidebar item hover shows its description.

- [ ] **Step 3: Commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "chore(ui): SP1 verification fixes"
```

(If no fixes were needed, skip this commit.)

---

## Self-review notes (author)

- **Spec coverage:** Tooltip (T2), InfoHint (T3), ReasonDialog (T4 + integrations T9/T10), FormField upgrade (T6), StatusBadge tooltip + statusMeaning (T5/T7), typography normalization bounded (T13), help seeding — fields (T11), statuses + nav + risk context (T12). Dependency + provider (T1), exports (T8), verification (T14). All spec §3–§9 items map to a task.
- **Risk-band help:** the spec lists risk score bands as seeded help. `riskScoreLabel`/`riskScoreTone` already exist in `status.ts`; the band tooltip is delivered via the risk surfaces using `InfoHint` during SP2's risk work, but the *content/util* is available now — noted here so it is not lost. (No dedicated task in SP1 to avoid touching risk pages outside the in-scope flows; tracked for SP2.)
- **Type consistency:** `statusMeaning(entity, status)` signature is identical in T5 (definition), T7 (`StatusBadge`), and T12 (`explain` usage). `rejectMut.mutateAsync` used in T9/T10 matches react-query's mutation API. `ReasonDialog` prop names (`open/onClose/onConfirm/title/description/placeholder/confirmLabel/tone/isLoading`) are identical across T4, T9, T10.
- **No placeholders:** every code step contains complete code; the only intentional fill-in is the grep output pasted into the tracked follow-up doc in T13.
