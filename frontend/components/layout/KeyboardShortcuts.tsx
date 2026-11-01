'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Keyboard, X } from 'lucide-react';

import { usePermissions } from '@/lib/hooks/usePermissions';
import { useLayout } from '@/components/providers/LayoutProvider';
import { useScrollLock } from '@/lib/hooks/useScrollLock';

interface GoTarget {
  key: string;
  label: string;
  href: string;
  /** NavVisibility key that must be true for this shortcut to apply. */
  vis?: 'engagements' | 'findings' | 'auditPlans' | 'auditUniverse' | 'riskRegister' | 'workflow' | 'reports' | 'requests' | 'assets' | 'users' | 'auditLogs';
}

/** `g` then a letter, like Gmail/GitHub. Only offered for pages the user can open. */
const GO_TARGETS: GoTarget[] = [
  { key: 'h', label: 'Home', href: '/dashboard' },
  { key: 'a', label: 'Approvals', href: '/workflow/approvals', vis: 'workflow' },
  { key: 'e', label: 'Engagements', href: '/audit/engagements', vis: 'engagements' },
  { key: 'f', label: 'Findings', href: '/audit/findings', vis: 'findings' },
  { key: 'p', label: 'Audit Programme', href: '/audit/plans', vis: 'auditPlans' },
  { key: 'u', label: 'Audit Universe', href: '/audit/universe', vis: 'auditUniverse' },
  { key: 'v', label: 'Reviews', href: '/audit/reports', vis: 'reports' },
  { key: 'r', label: 'Risk Register', href: '/risk', vis: 'riskRegister' },
  { key: 'q', label: 'Requests', href: '/requests', vis: 'requests' },
  { key: 's', label: 'Assets', href: '/assets', vis: 'assets' },
  { key: 'l', label: 'Audit Logs', href: '/logs', vis: 'auditLogs' },
  { key: 'n', label: 'Notifications', href: '/notifications' },
  { key: 'm', label: 'My profile', href: '/profile' },
  { key: 'c', label: 'Help Centre', href: '/help/center' },
];

const isTyping = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

/**
 * App-wide keyboard shortcuts plus the “?” cheat sheet.
 *   ?        show this sheet          /        open search (same as Ctrl K)
 *   g + key  go to a page             Esc      close dialogs
 * Never fires while the user is typing in a field.
 */
export const KeyboardShortcuts = (): JSX.Element | null => {
  const router = useRouter();
  const { nav } = usePermissions();
  const { setCommandPaletteOpen } = useLayout();
  const [open, setOpen] = useState(false);
  const goPending = useRef<number | null>(null);
  const navRef = useRef(nav);
  navRef.current = nav;

  useScrollLock(open);

  const targets = GO_TARGETS.filter((t) => !t.vis || nav[t.vis]);

  useEffect(() => {
    const clearPending = () => {
      if (goPending.current) window.clearTimeout(goPending.current);
      goPending.current = null;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;

      if (e.key === '?') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        clearPending();
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if (goPending.current) {
        const key = e.key.toLowerCase();
        clearPending();
        const target = GO_TARGETS.find((t) => t.key === key && (!t.vis || navRef.current[t.vis]));
        if (target) {
          e.preventDefault();
          router.push(target.href);
        }
        return;
      }
      if (e.key.toLowerCase() === 'g') {
        goPending.current = window.setTimeout(clearPending, 1200);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearPending();
    };
  }, [router, setCommandPaletteOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[65] flex items-start justify-center p-4 pt-[8vh]" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="absolute inset-0 bg-slate-900/40 animate-fade-in" onClick={() => setOpen(false)} aria-hidden />
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-white shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Keyboard className="h-4 w-4 text-primary" /> Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-text-muted hover:bg-surface-alt hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-6 p-5 sm:grid-cols-2">
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Anywhere</h3>
            <ul className="space-y-2 text-sm">
              <Row keys={['Ctrl', 'K']} label="Search records, pages and help" />
              <Row keys={['/']} label="Open search" />
              <Row keys={['?']} label="Show / hide this sheet" />
              <Row keys={['Esc']} label="Close a panel or dialog" />
            </ul>
            <p className="mt-4 text-xs text-text-secondary">
              In search, type a question (for example “how do I raise a finding”) to see matching help topics.
            </p>
          </section>
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Go to… (press <kbd className="rounded border border-border px-1">g</kbd>, then)
            </h3>
            <ul className="grid grid-cols-1 gap-1.5 text-sm">
              {targets.map((t) => (
                <Row key={t.key} keys={['g', t.key]} label={t.label} />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

const Row = ({ keys, label }: { keys: string[]; label: string }): JSX.Element => (
  <li className="flex items-center justify-between gap-3">
    <span className="text-text-primary">{label}</span>
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((k, i) => (
        <span key={k + i} className="flex items-center gap-1">
          {i > 0 && <span className="text-[10px] text-text-muted">then</span>}
          <kbd className="min-w-[1.5rem] rounded border border-border bg-surface-alt px-1.5 py-0.5 text-center text-[11px] font-medium text-text-secondary">
            {k}
          </kbd>
        </span>
      ))}
    </span>
  </li>
);
