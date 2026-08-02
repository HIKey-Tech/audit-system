'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, BellOff } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { notificationsApi } from '@/lib/api/notifications';
import { notificationHref } from '@/lib/notification-links';
import { formatRelative } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

const TABS: TabItem[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
];

export default function NotificationsPage(): JSX.Element {
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);

  const list = useQuery({
    queryKey: ['notifications', tab, page],
    queryFn: () =>
      notificationsApi.list({
        page,
        pageSize: 30,
        isRead: tab === 'unread' ? false : undefined,
      }),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: (r) => {
      toast.success(`Marked ${r.updated} as read`);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Workflow updates, escalations, and assignment alerts."
        actions={
          <Button
            variant="secondary"
            leftIcon={<CheckCheck className="h-4 w-4" />}
            onClick={() => markAll.mutate()}
            isLoading={markAll.isPending}
          >
            Mark all read
          </Button>
        }
      />

      <Card padded className="mb-4">
        <Tabs
          tabs={TABS}
          active={tab}
          onChange={(k) => {
            setTab(k as 'all' | 'unread');
            setPage(1);
          }}
        />
      </Card>

      <Card padded={false}>
        {list.isLoading ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !list.data || list.data.items.length === 0 ? (
          <EmptyState
            icon={<BellOff className="h-4 w-4" />}
            title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description="System events that need your attention will appear here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {list.data.items.map((n) => {
              const href = notificationHref(n.referenceType, n.referenceId);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.isRead) markRead.mutate(n.id);
                      if (href) router.push(href);
                    }}
                    className={cn(
                      'w-full px-5 py-4 text-left transition-colors hover:bg-surface-alt/40',
                      !n.isRead && 'bg-blue-50/30',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                          n.isRead ? 'bg-slate-300' : 'bg-info',
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm', !n.isRead ? 'font-semibold text-text-primary' : 'text-text-primary')}>
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">{n.body}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-text-muted">
                          {n.type} · {formatRelative(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
