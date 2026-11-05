'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Link2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProjectPlusEntityList } from '@/components/integrations/ProjectPlusEntityList';
import { projectPlusApi } from '@/lib/api/projectplus';
import { formatDate } from '@/lib/utils/format';
import { hasPermission, useSession } from '@/components/providers/AuthProvider';
import type { AuditEngagementDetail } from '@/lib/types/domain';

export const ProjectPlusTab = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const session = useSession();
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const canLink = hasPermission(session, 'projectplus:link');

  const status = useQuery({ queryKey: ['integration', 'projectplus', 'status'], queryFn: projectPlusApi.status });
  const linksKey = ['engagements', engagement.id, 'projectplus-entities'];
  const links = useQuery({
    queryKey: linksKey,
    queryFn: () => projectPlusApi.listLinks(engagement.id),
    enabled: Boolean(status.data?.enabled),
  });

  const link = useMutation({
    mutationFn: (target: { customerType: string; referenceCode: string }) => projectPlusApi.link(engagement.id, target),
    onSuccess: () => { toast.success('Project Plus entity linked'); qc.invalidateQueries({ queryKey: linksKey }); },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not link entity'),
  });
  const unlink = useMutation({
    mutationFn: projectPlusApi.unlink,
    onSuccess: () => { toast.success('Project Plus entity unlinked'); qc.invalidateQueries({ queryKey: linksKey }); },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not unlink entity'),
  });

  if (status.data && !status.data.enabled) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 h-5 w-5 text-text-muted" />
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Project Plus is not connected</h3>
            <p className="mt-1 text-sm text-text-secondary">This is optional. No audit workflow is blocked or changed while it remains disabled.</p>
          </div>
        </div>
      </Card>
    );
  }

  const linked = new Set((links.data ?? []).map((l) => `${l.customerType.toLowerCase()}|${l.referenceCode.toLowerCase()}`));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Linked Project Plus entities</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Optional, read-only context (vendor / customer identity) for this engagement. Project Plus is never modified.
            </p>
          </div>
          {canLink && (
            <Button size="sm" variant="secondary" leftIcon={<Link2 className="h-3.5 w-3.5" />} onClick={() => setPickerOpen(!pickerOpen)}>
              {pickerOpen ? 'Hide lookup' : 'Look up & link entity'}
            </Button>
          )}
        </div>
        {canLink && pickerOpen && (
          <div className="mt-4 rounded-lg border border-border bg-surface-subtle p-3.5">
            <ProjectPlusEntityList
              enabled={Boolean(status.data?.configured)}
              pageSize={6}
              renderAction={(entity, customerType) => {
                if (!entity.referenceCode) return <span className="text-xs text-text-muted">No reference code</span>;
                const isLinked = linked.has(`${customerType.toLowerCase()}|${entity.referenceCode.toLowerCase()}`);
                return (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isLinked}
                    isLoading={link.isPending}
                    onClick={() => link.mutate({ customerType, referenceCode: entity.referenceCode! })}
                  >
                    {isLinked ? 'Already linked' : 'Link'}
                  </Button>
                );
              }}
            />
          </div>
        )}
      </Card>

      <Card padded={false}>
        {links.isLoading ? (
          <div className="space-y-3 p-5"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : !links.data?.length ? (
          <EmptyState icon={<Building2 className="h-4 w-4" />} title="No Project Plus entities linked" description="Link a vendor or customer when it is relevant to this audit." />
        ) : (
          <ul className="divide-y divide-border">
            {links.data.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary">{l.fullName}</p>
                    <Badge tone="blue">{l.customerType}</Badge>
                    {l.lastStatus && <Badge tone={l.lastStatus.toLowerCase() === 'active' ? 'green' : 'gray'}>{l.lastStatus}</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    Ref {l.referenceCode}
                    {l.rcNumber ? ` · RC ${l.rcNumber}` : ''}
                    {l.tin ? ` · TIN ${l.tin}` : ''}
                    {l.lastSyncedAt ? ` · Linked ${formatDate(l.lastSyncedAt)}` : ''}
                  </p>
                </div>
                {canLink && (
                  <Button size="sm" variant="ghost" leftIcon={<Trash2 className="h-3.5 w-3.5" />} isLoading={unlink.isPending} onClick={() => unlink.mutate(l.id)}>
                    Unlink
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
