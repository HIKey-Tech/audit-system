'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils/cn';
import { formatRelative } from '@/lib/utils/format';
import { notificationsApi } from '@/lib/api/notifications';
import { useSession } from '@/components/providers/AuthProvider';

const TITLE_MAP: { match: RegExp; title: string }[] = [
  { match: /^\/dashboard/, title: 'Dashboard' },
  { match: /^\/audit\/universe/, title: 'Audit Universe' },
  { match: /^\/audit\/plans/, title: 'Audit Plans' },
  { match: /^\/audit\/engagements/, title: 'Engagements' },
  { match: /^\/audit\/findings/, title: 'Findings' },
  { match: /^\/audit\/reports/, title: 'Audit Reports' },
  { match: /^\/risk/, title: 'Risk Register' },
  { match: /^\/workflow/, title: 'Workflow' },
  { match: /^\/documents/, title: 'Documents' },
  { match: /^\/notifications/, title: 'Notifications' },
  { match: /^\/logs/, title: 'Audit Logs' },
  { match: /^\/integrations/, title: 'Integrations' },
  { match: /^\/predictive/, title: 'Predictive' },
  { match: /^\/settings/, title: 'Settings' },
];

const titleFor = (pathname: string | null): string => {
  if (!pathname) return 'IAMS';
  return TITLE_MAP.find((t) => t.match.test(pathname))?.title ?? 'IAMS';
};

export const Header = (): JSX.Element => {
  const pathname = usePathname();
  const session = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 60_000,
  });

  const { data: latestList } = useQuery({
    queryKey: ['notifications', 'latest'],
    queryFn: () => notificationsApi.list({ pageSize: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface-elevated px-6">
      <div className="min-w-0">
        <h1 className="text-base font-semibold text-text-primary truncate">
          {titleFor(pathname)}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Notifications"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors"
          >
            <Bell className="h-4 w-4" />
            {(unread?.unread ?? 0) > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">
                {unread!.unread > 9 ? '9+' : unread!.unread}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-lg border border-border bg-white shadow-card-hover animate-fade-in">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-xs font-semibold text-text-primary">Notifications</p>
                <Link
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                {!latestList ? (
                  <div className="space-y-2 p-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="h-12 rounded animate-pulse bg-slate-100" />
                    ))}
                  </div>
                ) : latestList.items.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-text-secondary">No notifications.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {latestList.items.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!n.isRead) markRead.mutate(n.id);
                            setOpen(false);
                          }}
                          className={cn(
                            'w-full px-4 py-3 text-left transition-colors hover:bg-surface-alt',
                            !n.isRead && 'bg-blue-50/40',
                          )}
                        >
                          <p className={cn('text-xs', !n.isRead ? 'font-semibold text-text-primary' : 'text-text-primary')}>
                            {n.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-text-secondary">
                            {n.body}
                          </p>
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-text-muted">
                            {formatRelative(n.createdAt)}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="hidden sm:block text-right">
          <p className="text-xs font-semibold text-text-primary">
            {session.displayName || `${session.firstName} ${session.lastName}`}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-text-muted">
            {(session.roles[0] ?? 'viewer').replace(/_/g, ' ')}
          </p>
        </div>
      </div>
    </header>
  );
};
