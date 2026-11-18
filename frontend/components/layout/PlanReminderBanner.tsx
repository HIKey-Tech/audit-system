'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ClipboardList, X } from 'lucide-react';
import { plansApi, type PendingPlan } from '@/lib/api/audit';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { cn } from '@/lib/utils/cn';

const DISMISS_KEY = 'iams.plan-reminder.dismissed';

/** Changes whenever a programme is added, submitted or finishes a to-do, so a dismissal never hides new news. */
const signature = (plans: PendingPlan[]): string =>
  plans.map((p) => `${p.id}:${p.status}:${p.itemCount}`).join('|');

const readDismissed = (): string | null => {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
};

/**
 * A slim reminder above the page content for the person's own audit programmes that are still
 * drafts (or were rejected): what is left to do and a link straight to each. It never blocks the
 * page, starts collapsed to one line, and can be hidden for the rest of the session.
 */
export const PlanReminderBanner = (): JSX.Element | null => {
  const { user, hasPermission } = usePermissions();
  const allowed = !!user && hasPermission('plan:create');
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => setDismissed(readDismissed()), []);

  const pending = useQuery({
    queryKey: ['plans', 'pending'],
    queryFn: plansApi.pending,
    enabled: allowed,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const plans = pending.data ?? [];
  if (!allowed || pending.isError || plans.length === 0) return null;

  const sig = signature(plans);
  if (dismissed === sig) return null;

  const hide = (): void => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, sig);
    } catch {
      // Storage unavailable: just hide it until the next load.
    }
    setDismissed(sig);
  };

  const first = plans[0];
  const summary =
    plans.length === 1
      ? `"${first.title}" ${first.status === 'rejected' ? 'was rejected and needs changes' : "is still a draft — it hasn't been submitted for approval"}`
      : `${plans.length} audit programmes haven't been submitted for approval yet`;

  return (
    <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900">
      <div className="flex items-center gap-2 px-3 py-2">
        <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="truncate font-medium">{summary}</span>
          <span className="shrink-0 text-xs text-amber-700">{open ? 'Hide steps' : 'See what is left'}</span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
        <button type="button" onClick={hide} aria-label="Hide this reminder for now" className="rounded p-1 text-amber-700 hover:bg-amber-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <ul className="space-y-3 border-t border-amber-200 px-3 py-3">
          {plans.map((p) => (
            <li key={p.id}>
              <Link href={`/audit/plans/${p.id}`} className="font-semibold underline-offset-2 hover:underline">
                {p.title} ({p.year})
              </Link>
              <span className="ml-2 text-xs uppercase tracking-wide text-amber-700">{p.status}</span>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-800">
                {p.todo.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
