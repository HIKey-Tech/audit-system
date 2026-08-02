'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, CornerDownLeft, Briefcase, AlertTriangle, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { NAV_LINKS, type NavLink } from '@/lib/navigation';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import { useScrollLock } from '@/lib/hooks/useScrollLock';
import { useLayout } from '@/components/providers/LayoutProvider';
import { engagementsApi, findingsApi } from '@/lib/api/audit';

interface Command {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: NavLink['icon'];
  group: 'Go to' | 'Engagements' | 'Findings';
}

/** Minimum characters before we hit the API for records. */
const RECORD_SEARCH_MIN = 2;

export const CommandPalette = (): JSX.Element | null => {
  const router = useRouter();
  const { nav } = usePermissions();
  const { commandPaletteOpen: open, setCommandPaletteOpen: setOpen } = useLayout();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query.trim(), 250);
  const searchRecords = open && debouncedQuery.length >= RECORD_SEARCH_MIN;

  // Read inside the key handler without re-registering the listener each toggle.
  const openRef = useRef(open);
  openRef.current = open;

  // Global open/close shortcut. Registered once for the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!openRef.current);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useScrollLock(open);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    // Autofocus after the panel mounts.
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const engagements = useQuery({
    queryKey: ['command-palette', 'engagements', debouncedQuery],
    queryFn: () => engagementsApi.list({ pageSize: 5, search: debouncedQuery }),
    enabled: searchRecords && nav.engagements,
    staleTime: 30_000,
  });

  const findings = useQuery({
    queryKey: ['command-palette', 'findings', debouncedQuery],
    queryFn: () => findingsApi.list({ pageSize: 5, search: debouncedQuery }),
    enabled: searchRecords && nav.findings,
    staleTime: 30_000,
  });

  const commands: Command[] = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const destinations: Command[] = NAV_LINKS.filter(
      (l) => !l.comingSoon && (!l.visKey || nav[l.visKey]),
    )
      .filter(
        (l) =>
          !needle ||
          l.label.toLowerCase().includes(needle) ||
          (l.description?.toLowerCase().includes(needle) ?? false),
      )
      .map((l) => ({
        id: `nav:${l.href}`,
        label: l.label,
        hint: l.description,
        href: l.href,
        icon: l.icon,
        group: 'Go to' as const,
      }));

    const engagementCommands: Command[] = (engagements.data?.items ?? []).map((e) => ({
      id: `engagement:${e.id}`,
      label: e.title,
      hint: `${e.referenceNumber} · ${e.leadAuditorName}`,
      href: `/audit/engagements/${e.id}`,
      icon: Briefcase,
      group: 'Engagements' as const,
    }));

    const findingCommands: Command[] = (findings.data?.items ?? []).map((f) => ({
      id: `finding:${f.id}`,
      label: f.title,
      hint: `${f.engagementReference} · ${f.severity}`,
      href: `/audit/findings/${f.id}`,
      icon: AlertTriangle,
      group: 'Findings' as const,
    }));

    // Records first once the user has typed enough — they're the specific thing
    // being looked for; destinations are always available as a fallback.
    return [...engagementCommands, ...findingCommands, ...destinations.slice(0, 8)];
  }, [query, nav, engagements.data, findings.data]);

  // Keep the highlight in range as results stream in.
  useEffect(() => {
    setActiveIndex((i) => (i >= commands.length ? 0 : i));
  }, [commands.length]);

  const go = (command: Command | undefined) => {
    if (!command) return;
    setOpen(false);
    router.push(command.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (commands.length ? (i + 1) % commands.length : 0));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (commands.length ? (i - 1 + commands.length) % commands.length : 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      go(commands[activeIndex]);
    }
  };

  // Scroll the highlighted row into view when navigating by keyboard.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  if (!open) return null;

  const isSearching =
    searchRecords && (engagements.isFetching || findings.isFetching);
  let lastGroup = '';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search IAMS"
    >
      <div
        className="absolute inset-0 bg-slate-900/40 animate-fade-in"
        onClick={() => setOpen(false)}
        aria-hidden
      />

      <div
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-border bg-white shadow-2xl animate-fade-in"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search engagements, findings, or jump to a page…"
            aria-label="Search"
            aria-autocomplete="list"
            className="h-12 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          {isSearching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-text-muted" />}
          <kbd className="shrink-0 rounded border border-border bg-surface-alt px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[55vh] overflow-y-auto scrollbar-thin p-2" role="listbox">
          {commands.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-text-secondary">
              {query.trim().length > 0 && query.trim().length < RECORD_SEARCH_MIN
                ? `Type ${RECORD_SEARCH_MIN}+ characters to search records.`
                : 'No matches.'}
            </p>
          ) : (
            commands.map((command, index) => {
              const Icon = command.icon;
              const active = index === activeIndex;
              const showGroup = command.group !== lastGroup;
              lastGroup = command.group;

              return (
                <div key={command.id}>
                  {showGroup && (
                    <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-text-muted first:pt-1">
                      {command.group}
                    </p>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-index={index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => go(command)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                      active ? 'bg-primary/10 text-primary' : 'text-text-primary hover:bg-surface-alt',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{command.label}</span>
                      {command.hint && (
                        <span className="block truncate text-[11px] text-text-secondary">
                          {command.hint}
                        </span>
                      )}
                    </span>
                    {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
