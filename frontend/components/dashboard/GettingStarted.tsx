'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, CircleHelp, Rocket, X } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useSession } from '@/components/providers/AuthProvider';

interface Step {
  id: string;
  label: string;
  hint: string;
  href: string;
  /** Help Centre article that explains it step by step. */
  help: string;
}

const SIGNATURE: Step = {
  id: 'signature',
  label: 'Add your signature',
  hint: 'Used when you approve or sign anything.',
  href: '/profile',
  help: 'signature',
};
const SHORTCUTS: Step = {
  id: 'shortcuts',
  label: 'Learn the shortcuts',
  hint: 'Press ? anywhere. Ctrl K searches records and answers questions.',
  href: '/help/center',
  help: 'search',
};

const STEPS_MANAGER: Step[] = [
  SIGNATURE,
  { id: 'programme', label: 'Plan the year: audit programme', hint: 'Create a programme and add the entities to audit.', href: '/audit/plans', help: 'prog-create' },
  { id: 'start', label: 'Start an audit', hint: 'Use the Start audit button on Home or Engagements.', href: '/audit/engagements', help: 'wizard' },
  { id: 'approvals', label: 'Clear your approvals', hint: 'Anything waiting for your sign-off.', href: '/workflow/approvals', help: 'approve-do' },
  SHORTCUTS,
];

const STEPS_AUDITOR: Step[] = [
  SIGNATURE,
  { id: 'engagement', label: 'Open your engagement', hint: 'Check “What’s next” to see what it is waiting for.', href: '/audit/engagements', help: 'eng-overview' },
  { id: 'checklist', label: 'Test a control', hint: 'Record Passed, Failed or Not applicable.', href: '/audit/engagements', help: 'checklists' },
  { id: 'wp', label: 'Write a working paper', hint: 'Save as draft, then submit for review.', href: '/audit/engagements', help: 'wp' },
  { id: 'finding', label: 'Raise a finding', hint: 'From a failed control, with root cause and recommendation.', href: '/audit/findings', help: 'finding-raise' },
  SHORTCUTS,
];

const STEPS_EXECUTIVE: Step[] = [
  SIGNATURE,
  { id: 'approvals', label: 'Review what is waiting for you', hint: 'Approve & sign, or reject with a reason.', href: '/workflow/approvals', help: 'approve-do' },
  { id: 'analytics', label: 'See the programme at a glance', hint: 'KPIs, backlog and findings by severity.', href: '/analytics', help: 'ch-analytics' },
  { id: 'reviews', label: 'Read an issued review', hint: 'Open the Reviews register.', href: '/audit/reports', help: 'review-tab' },
  SHORTCUTS,
];

const STEPS_VIEWER: Step[] = [
  { id: 'engagements', label: 'Browse engagements', hint: 'See the status and findings of each audit.', href: '/audit/engagements', help: 'eng-list' },
  { id: 'findings', label: 'Browse findings', hint: 'Filter by severity and status.', href: '/audit/findings', help: 'findings-register' },
  SHORTCUTS,
];

interface Stored {
  done: string[];
  dismissed: boolean;
}

export const gettingStartedKey = (userId: string): string => `iams.gettingStarted.${userId}`;

const read = (key: string): Stored => {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as Stored;
  } catch {
    /* storage unavailable (private window) — behave as first visit */
  }
  return { done: [], dismissed: false };
};

/**
 * First-week checklist on Home, tailored to the user's role. Progress lives in
 * the browser only (a convenience, not a record); it can be dismissed and is
 * restorable from the Help Centre.
 */
export const GettingStarted = (): JSX.Element | null => {
  const session = useSession();
  const { isAuditee, isFieldAuditor, canManageAuditProgramme, isExecutive } = usePermissions();
  const key = gettingStartedKey(session.id);
  const [state, setState] = useState<Stored | null>(null);

  useEffect(() => setState(read(key)), [key]);

  const steps = useMemo(() => {
    if (canManageAuditProgramme) return STEPS_MANAGER;
    if (isFieldAuditor) return STEPS_AUDITOR;
    if (isExecutive) return STEPS_EXECUTIVE;
    return STEPS_VIEWER;
  }, [canManageAuditProgramme, isFieldAuditor, isExecutive]);

  const save = useCallback(
    (next: Stored) => {
      setState(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [key],
  );

  // Auditees already get a purpose-built “What you need to do here” card.
  if (isAuditee || !state || state.dismissed) return null;

  const done = new Set(state.done);
  const count = steps.filter((s) => done.has(s.id)).length;
  const toggle = (id: string) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    save({ ...state, done: [...next] });
  };
  const pct = Math.round((count / steps.length) * 100);

  return (
    <Card padded>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Rocket className="h-4 w-4 text-primary" aria-hidden />
            {count === steps.length ? 'You are all set' : 'Getting started'}
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {count}/{steps.length}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">
            A few things worth doing in your first week. Tick them off as you go.
          </p>
        </div>
        <button
          type="button"
          onClick={() => save({ ...state, dismissed: true })}
          className="shrink-0 rounded-md p-1 text-text-muted hover:bg-surface-alt hover:text-text-primary"
          aria-label="Hide getting-started checklist"
          title="Hide (you can bring it back from the Help Centre)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-alt" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-3 grid gap-2 md:grid-cols-2">
        {steps.map((s) => {
          const isDone = done.has(s.id);
          return (
            <li
              key={s.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3 py-2.5',
                isDone ? 'border-primary/30 bg-primary/5' : 'border-border bg-white',
              )}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={isDone}
                aria-label={`Mark “${s.label}” ${isDone ? 'not done' : 'done'}`}
                onClick={() => toggle(s.id)}
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                  isDone ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white hover:border-primary',
                )}
              >
                {isDone && <Check className="h-3 w-3" aria-hidden />}
              </button>
              <div className="min-w-0 flex-1">
                <Link
                  href={s.href}
                  className={cn(
                    'text-sm font-medium hover:text-primary',
                    isDone ? 'text-text-secondary line-through' : 'text-text-primary',
                  )}
                >
                  {s.label}
                </Link>
                <p className="text-[11px] text-text-secondary">{s.hint}</p>
              </div>
              <Link
                href={`/help/center?a=${s.help}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                title="Step-by-step guide with screenshots"
              >
                <CircleHelp className="h-3.5 w-3.5" aria-hidden /> How
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
};
