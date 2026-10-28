'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CloudCog, Database, Link2, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { imocApi, ImocStoredTicket } from '@/lib/api/imoc';
import { formatDate } from '@/lib/utils/format';
import { useSession, hasPermission } from '@/components/providers/AuthProvider';
import type { AuditEngagementDetail } from '@/lib/types/domain';

const toneForSla = (status: string | null): 'green' | 'amber' | 'red' | 'gray' => {
  if (!status) return 'gray';
  if (status.toLowerCase() === 'break') return 'red';
  if (status.toLowerCase() === 'normal') return 'green';
  return 'amber';
};

export const ImocTicketsTab = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const session = useSession();
  const qc = useQueryClient();
  const [ticketNumber, setTicketNumber] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [storeSearchQuery, setStoreSearchQuery] = useState('');

  const canLink = hasPermission(session, 'imoc:link');
  const canRefresh = hasPermission(session, 'imoc:sync');
  const canCapture = hasPermission(session, 'imoc:capture');

  const status = useQuery({ queryKey: ['integration', 'imoc', 'status'], queryFn: imocApi.status });
  const links = useQuery({
    queryKey: ['engagements', engagement.id, 'imoc-tickets'],
    queryFn: () => imocApi.listLinks(engagement.id),
  });

  const storedTickets = useQuery({
    queryKey: ['integration', 'imoc', 'store', 'picker', storeSearchQuery],
    queryFn: () => imocApi.listStoredTickets({ search: storeSearchQuery || undefined, pageSize: 8 }),
    enabled: pickerOpen,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'imoc-tickets'] });
    qc.invalidateQueries({ queryKey: ['integration', 'imoc', 'status'] });
  };

  const link = useMutation({
    mutationFn: (target: { orderNumber?: string; orderId?: string }) =>
      imocApi.link(engagement.id, target),
    onSuccess: () => {
      toast.success('IMOC ticket linked');
      setTicketNumber('');
      setPickerOpen(false);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not link IMOC ticket'),
  });

  const refresh = useMutation({
    mutationFn: imocApi.refresh,
    onSuccess: () => { toast.success('IMOC ticket refreshed'); invalidate(); },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not refresh ticket'),
  });

  const capture = useMutation({
    mutationFn: imocApi.capture,
    onSuccess: () => {
      toast.success('Redacted IMOC snapshot captured as audit evidence');
      invalidate();
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'evidence'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not capture snapshot'),
  });

  const unlink = useMutation({
    mutationFn: imocApi.unlink,
    onSuccess: () => { toast.success('IMOC ticket unlinked'); invalidate(); },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not unlink ticket'),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const orderNumber = ticketNumber.trim();
    if (orderNumber) link.mutate({ orderNumber });
  };

  if (status.data && !status.data.enabled) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <CloudCog className="mt-0.5 h-5 w-5 text-text-muted" />
          <div>
            <h3 className="text-sm font-semibold text-text-primary">IMOC is not connected</h3>
            <p className="mt-1 text-sm text-text-secondary">{status.data.connectionMessage}</p>
            <p className="mt-2 text-xs text-text-muted">No audit workflow is blocked or changed while IMOC remains disabled.</p>
          </div>
        </div>
      </Card>
    );
  }

  const alreadyLinkedOrderIds = new Set((links.data || []).map((l) => l.orderId));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Linked IMOC tickets</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Read-only service-ticket context for this engagement. IMOC never changes IAMS workflow status or approvals.
            </p>
          </div>
          {status.data && (
            <Badge tone={status.data.configured ? 'green' : 'amber'}>
              {status.data.configured ? 'Connected' : 'Configuration incomplete'}
            </Badge>
          )}
        </div>

        {canLink && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <form onSubmit={submit} className="flex flex-1 flex-wrap gap-2">
                <Input
                  value={ticketNumber}
                  onChange={(event) => setTicketNumber(event.target.value)}
                  placeholder="Type IMOC ticket number (e.g. INCT2607220012)"
                  aria-label="IMOC ticket number"
                  className="max-w-sm"
                />
                <Button
                  type="submit"
                  size="sm"
                  leftIcon={<Link2 className="h-3.5 w-3.5" />}
                  isLoading={link.isPending}
                >
                  Link ticket
                </Button>
              </form>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                leftIcon={<Database className="h-3.5 w-3.5" />}
                onClick={() => setPickerOpen(!pickerOpen)}
              >
                {pickerOpen ? 'Hide store picker' : 'Attach from IMOC store'}
              </Button>
            </div>

            {pickerOpen && (
              <div className="rounded-lg border border-border bg-surface-subtle p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="h-4 w-4 text-text-muted" />
                  <Input
                    value={storeSearchQuery}
                    onChange={(e) => setStoreSearchQuery(e.target.value)}
                    placeholder="Search stored tickets by number or title..."
                    className="h-8 text-xs"
                  />
                </div>
                {storedTickets.isLoading ? (
                  <div className="space-y-2 py-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : !storedTickets.data?.items?.length ? (
                  <p className="text-xs text-text-muted py-2 text-center">
                    No matching ingested tickets in local store.
                  </p>
                ) : (
                  <ul className="divide-y divide-border max-h-56 overflow-y-auto">
                    {storedTickets.data.items.map((st: ImocStoredTicket) => {
                      const isLinked = alreadyLinkedOrderIds.has(st.orderId);
                      return (
                        <li key={st.id} className="flex items-center justify-between py-2 text-xs">
                          <div>
                            <span className="font-mono font-semibold text-text-primary mr-2">
                              {st.orderNumber}
                            </span>
                            <span className="text-text-secondary">{st.orderName}</span>
                            <div className="text-[11px] text-text-muted mt-0.5">
                              {st.category ?? 'Uncategorised'} · {st.orderStatus}
                              {st.slaStatus ? ` · OLA: ${st.slaStatus}` : ''}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={isLinked}
                            isLoading={link.isPending}
                            onClick={() => link.mutate({ orderNumber: st.orderNumber, orderId: st.orderId })}
                          >
                            {isLinked ? 'Already linked' : 'Attach'}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card padded={false}>
        {links.isLoading ? (
          <div className="space-y-3 p-5"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : !links.data?.length ? (
          <EmptyState icon={<CloudCog className="h-4 w-4" />} title="No IMOC tickets linked" description="Link an existing service ticket when it is relevant to this audit." />
        ) : (
          <ul className="divide-y divide-border">
            {links.data.map((ticket) => (
              <li key={ticket.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-semibold text-text-primary">{ticket.orderNumber}</p>
                    {ticket.lastStatus && <Badge tone="blue">{ticket.lastStatus}</Badge>}
                    {ticket.lastSlaStatus && <Badge tone={toneForSla(ticket.lastSlaStatus)}>OLA: {ticket.lastSlaStatus}</Badge>}
                  </div>
                  <p className="mt-1 truncate text-sm text-text-secondary">{ticket.orderName ?? 'Untitled IMOC ticket'}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {ticket.modelName ?? ticket.modelType ?? 'IMOC ticket'}
                    {ticket.lastStepName ? ` · ${ticket.lastStepName}` : ''}
                    {ticket.lastSyncedAt ? ` · Refreshed ${formatDate(ticket.lastSyncedAt)}` : ' · Not refreshed'}
                  </p>
                  {ticket.lastSyncError && <p className="mt-1 text-xs text-danger">Last refresh: {ticket.lastSyncError}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {canRefresh && <Button size="sm" variant="secondary" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} isLoading={refresh.isPending} onClick={() => refresh.mutate(ticket.id)}>Refresh</Button>}
                  {canCapture && <Button size="sm" variant="secondary" leftIcon={<ShieldCheck className="h-3.5 w-3.5" />} isLoading={capture.isPending} onClick={() => capture.mutate(ticket.id)}>Capture evidence</Button>}
                  {canLink && <Button size="sm" variant="ghost" leftIcon={<Trash2 className="h-3.5 w-3.5" />} isLoading={unlink.isPending} onClick={() => unlink.mutate(ticket.id)}>Unlink</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
