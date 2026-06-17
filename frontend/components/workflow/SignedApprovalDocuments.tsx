'use client';

import { useQuery } from '@tanstack/react-query';
import { FileCheck2, Download } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { workflowApi } from '@/lib/api/workflow';

/**
 * Lists the frozen, signed artifacts generated when an approval completed.
 * Renders nothing until there is at least one. Pass `approvalId` directly, or
 * `entityType` + `entityId` to resolve the approval first (for entity detail
 * pages — plan, working paper — that don't hold the approval id).
 */
export function SignedApprovalDocuments(
  props: { approvalId: string } | { entityType: string; entityId: string },
): JSX.Element | null {
  const direct = 'approvalId' in props ? props.approvalId : undefined;

  const resolved = useQuery({
    queryKey: ['workflow', 'approval', 'by-entity', props],
    queryFn: () =>
      'entityType' in props
        ? workflowApi.getApprovalByEntity(props.entityType, props.entityId).catch(() => null)
        : Promise.resolve(null),
    enabled: !direct && 'entityType' in props,
  });

  const approvalId = direct ?? resolved.data?.id ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['approval', approvalId, 'signed'],
    queryFn: () => workflowApi.signedApprovalDocuments(approvalId),
    enabled: !!approvalId,
  });

  if ((!direct && resolved.isLoading) || (approvalId && isLoading)) {
    return (
      <Card>
        <CardHeader title="Signed document" />
        <Skeleton className="h-12 w-full" />
      </Card>
    );
  }
  if (!approvalId || !data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Signed document"
        subtitle="Frozen copy with every approver's signature, generated when this was fully approved."
      />
      <ul className="space-y-1.5">
        {data.map((d) => (
          <li key={d.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
            <FileCheck2 className="h-4 w-4 shrink-0 text-success" />
            <span className="min-w-0 flex-1 truncate text-sm text-text-primary">Signed document</span>
            <a
              href={d.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
