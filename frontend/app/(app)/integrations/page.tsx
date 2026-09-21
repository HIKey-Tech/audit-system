'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CloudCog, Search } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { imocApi } from '@/lib/api/imoc';
import { useSession, hasPermission } from '@/components/providers/AuthProvider';

export default function IntegrationsPage(): JSX.Element {
  const session = useSession();
  const canReadImoc = hasPermission(session, 'imoc:read');
  const canSyncImoc = hasPermission(session, 'imoc:sync');
  const [orderNumber, setOrderNumber] = useState('');
  const status = useQuery({ queryKey: ['integration', 'imoc', 'status'], queryFn: imocApi.status });
  const search = useMutation({
    mutationFn: (number: string) => imocApi.search({ orderNumber: number, page: 1, pageSize: 20 }),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not query IMOC'),
  });
  const sync = useMutation({
    mutationFn: () => imocApi.sync(),
    onSuccess: (result) => toast.success(`Refreshed ${result.refreshed} linked ticket(s)${result.failed ? `; ${result.failed} failed` : ''}`),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not refresh IMOC tickets'),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (orderNumber.trim()) search.mutate(orderNumber.trim());
  };

  return (
    <div>
      <PageHeader title="Integrations" subtitle="Read-only connections to approved GBB systems." />
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <CloudCog className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold text-text-primary">IMOC service tickets</h2>
              {status.isLoading ? <Skeleton className="mt-2 h-4 w-80" /> : <p className="mt-1 text-sm text-text-secondary">{status.data?.connectionMessage}</p>}
              {status.data && <p className="mt-2 text-xs text-text-muted">{status.data.linkedTicketCount} active ticket link(s){status.data.lastSuccessfulSyncAt ? ` · last successful refresh ${new Date(status.data.lastSuccessfulSyncAt).toLocaleString()}` : ''}</p>}
            </div>
          </div>
          {status.data && <Badge tone={status.data.enabled && status.data.configured ? 'green' : 'amber'}>{status.data.enabled && status.data.configured ? 'Configured' : status.data.enabled ? 'Awaiting configuration' : 'Disabled'}</Badge>}
        </div>
        {canSyncImoc && status.data?.enabled && <div className="mt-4"><Button size="sm" variant="secondary" isLoading={sync.isPending} onClick={() => sync.mutate()}>Refresh linked tickets</Button></div>}
      </Card>

      {canReadImoc && (
        <Card className="mt-5">
          <h2 className="text-base font-semibold text-text-primary">Find an IMOC ticket</h2>
          <p className="mt-1 text-sm text-text-secondary">Search is read-only. Link relevant results from an audit engagement, not from this page.</p>
          <form onSubmit={submit} className="mt-4 flex flex-wrap gap-2">
            <Input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder="Ticket number" className="max-w-sm" />
            <Button type="submit" size="sm" leftIcon={<Search className="h-3.5 w-3.5" />} isLoading={search.isPending} disabled={!status.data?.configured}>Search</Button>
          </form>
          {search.data && (search.data.items.length ? (
            <ul className="mt-5 divide-y divide-border rounded-md border border-border">
              {search.data.items.map((ticket) => <li key={ticket.orderId} className="px-4 py-3"><p className="font-mono text-sm font-semibold text-text-primary">{ticket.orderNumber}</p><p className="text-sm text-text-secondary">{ticket.orderName ?? 'Untitled ticket'}</p><p className="mt-1 text-xs text-text-muted">{ticket.modelName ?? ticket.modelType ?? 'IMOC'} · {ticket.orderStatus ?? 'Unknown status'}{ticket.slaStatus ? ` · SLA: ${ticket.slaStatus}` : ''}</p></li>)}
            </ul>
          ) : <div className="mt-5"><EmptyState icon={<Search className="h-4 w-4" />} title="No tickets found" description="Try another ticket number or confirm the IMOC search scope." /></div>)}
        </Card>
      )}
    </div>
  );
}
