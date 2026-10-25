'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, ArrowRight } from 'lucide-react';
import { notificationsApi } from '@/lib/api/notifications';
import { NotificationDto } from '@/lib/types/domain';

export function NotificationWatcher(): null {
  const router = useRouter();
  const queryClient = useQueryClient();
  const knownIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  // Poll for latest unread notifications every 3 seconds
  const { data } = useQuery({
    queryKey: ['notifications', 'live-watcher'],
    queryFn: () => notificationsApi.list({ pageSize: 5, isRead: false }),
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
  });

  const getTargetUrl = (n: NotificationDto): string => {
    if (!n.referenceType || !n.referenceId) return '/notifications';
    if (n.referenceType === 'workflow_request') return `/requests/${n.referenceId}`;
    if (n.referenceType === 'workflow_approval') return '/workflow/approvals';
    if (n.referenceType === 'audit_finding') return `/audit/findings/${n.referenceId}`;
    if (n.referenceType === 'audit_engagement') return `/audit/engagements/${n.referenceId}`;
    return '/notifications';
  };

  useEffect(() => {
    const items = data?.items ?? [];
    if (!items.length) return;

    if (isFirstLoad.current) {
      // First mount: seed known IDs so existing notifications don't trigger popups
      items.forEach((item) => knownIds.current.add(item.id));
      isFirstLoad.current = false;
      return;
    }

    // Subsequent polls: check for genuinely new notifications
    const newItems = items.filter((item) => !knownIds.current.has(item.id));

    if (newItems.length > 0) {
      // Invalidate relevant queries so active screens refresh automatically
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['workflow', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'latest'] });

      for (const item of newItems) {
        knownIds.current.add(item.id);
        const targetUrl = getTargetUrl(item);

        toast(item.title, {
          description: item.body,
          icon: <Bell className="h-4 w-4 text-emerald-500" />,
          duration: 5000,
          action: {
            label: 'View',
            onClick: () => {
              void notificationsApi.markRead(item.id).catch(() => {});
              router.push(targetUrl);
            },
          },
        });
      }
    }
  }, [data, queryClient, router]);

  return null;
}
