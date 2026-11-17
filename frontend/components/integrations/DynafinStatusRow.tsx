'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { dynafinApi } from '@/lib/api/dynafin';

/**
 * One-line status for the optional, read-only Dynafin connection. Shown beside the other
 * integrations. Until Dynafin releases its API the connection shows "Coming soon" and the
 * financial analyses run on uploaded exports instead — nothing is blocked.
 */
export const DynafinStatusRow = (): JSX.Element | null => {
  const status = useQuery({
    queryKey: ['integration', 'dynafin', 'status'],
    queryFn: dynafinApi.status,
    // A user without integration:read simply does not see this row.
    retry: false,
  });

  const test = useMutation({
    mutationFn: dynafinApi.check,
    onSuccess: (r) =>
      r.reachable && r.authenticated
        ? toast.success('Dynafin is reachable and authenticated')
        : toast.error(`Dynafin test failed: ${r.lastError ?? 'service unreachable'}`),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Connection test failed'),
  });

  if (status.isError || !status.data) return null;
  const { enabled, configured, sampleData } = status.data;

  const badge = !enabled
    ? { tone: 'gray' as const, text: 'Coming soon' }
    : sampleData
      ? { tone: 'amber' as const, text: 'Sample data' }
      : configured
        ? { tone: 'green' as const, text: 'Configured' }
        : { tone: 'amber' as const, text: 'Configuration pending' };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
      <span>
        <span className="font-semibold text-text-primary">Dynafin</span>
        <span className="ml-2 text-text-secondary">
          {enabled
            ? sampleData
              ? 'Showing made-up sample data for demonstration only'
              : 'Optional, read-only finance data for the financial audit analyses'
            : 'Live connection coming soon — until then, financial analyses run on exports uploaded from Dynafin'}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <Badge tone={badge.tone}>{badge.text}</Badge>
        {enabled && !sampleData && (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            isLoading={test.isPending}
            onClick={() => test.mutate()}
          >
            Test connection
          </Button>
        )}
      </span>
    </div>
  );
};
