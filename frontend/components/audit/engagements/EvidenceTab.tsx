'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, FileType2, Download, AlertOctagon } from 'lucide-react';
import { toast } from 'sonner';

import Link from 'next/link';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { evidenceApi, workingPapersApi } from '@/lib/api/audit';
import { assetsApi } from '@/lib/api/assets';
import { documentsApi } from '@/lib/api/documents';
import { formatDate, formatFileSize } from '@/lib/utils/format';
import { useSession, hasPermission } from '@/components/providers/AuthProvider';
import { cn } from '@/lib/utils/cn';
import type { AuditEngagementDetail, AuditEvidence } from '@/lib/types/domain';

export const EvidenceTab = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const qc = useQueryClient();
  const session = useSession();
  const canDispute = hasPermission(session, 'evidence:dispute');
  const canLinkAsset = hasPermission(session, 'asset:link');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [disputing, setDisputing] = useState<AuditEvidence | null>(null);

  const list = useQuery({
    queryKey: ['engagements', engagement.id, 'evidence'],
    queryFn: () => evidenceApi.listByEngagement(engagement.id),
  });

  // Resolve a linked working-paper id to its title so each evidence row shows
  // which paper it supports (the other half of the WP "Linked evidence" section).
  const workingPapers = useQuery({
    queryKey: ['engagements', engagement.id, 'working-papers'],
    queryFn: () => workingPapersApi.listByEngagement(engagement.id),
  });
  const wpTitleById = useMemo(
    () => new Map((workingPapers.data ?? []).map((wp) => [wp.id, wp.title])),
    [workingPapers.data],
  );

  // Evidence upload/dispute change the engagement's evidence aggregate, so refresh
  // both the evidence list AND the engagement detail (the StatusStepper reads
  // engagement.evidenceCount from the detail payload).
  const refreshEvidence = () => {
    qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'evidence'] });
    qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
  };

  const upload = useMutation({
    mutationFn: (file: File) => evidenceApi.upload(engagement.id, file),
    onSuccess: () => {
      toast.success('Evidence uploaded');
      refreshEvidence();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to upload'),
  });

  const dispute = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      evidenceApi.dispute(id, reason),
    onSuccess: () => {
      toast.success('Evidence disputed');
      refreshEvidence();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((f) => upload.mutate(f));
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-10 px-4 text-center transition-colors',
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border bg-surface-alt hover:border-primary hover:bg-primary/5',
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary">
          <Upload className="h-4 w-4" />
        </div>
        <p className="mt-2 text-sm font-medium text-text-primary">
          {upload.isPending ? 'Uploading…' : 'Click or drop files to upload evidence'}
        </p>
        <p className="text-xs text-text-secondary">
          Any file type · maps directly to engagement {engagement.referenceNumber}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <Card padded={false}>
        {list.isLoading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !list.data || list.data.length === 0 ? (
          <EmptyState
            icon={<FileType2 className="h-4 w-4" />}
            title="No evidence yet"
            description="Upload files to attach to this engagement."
          />
        ) : (
          <ul className="divide-y divide-border">
            {list.data.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/5 text-primary">
                  <FileType2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{ev.fileName}</p>
                  <p className="text-[11px] text-text-muted">
                    {formatFileSize(ev.fileSize)} · {ev.uploadedByName} · {formatDate(ev.createdAt)}
                    {ev.isDisputed && ' · Disputed'}
                  </p>
                  {ev.workingPaperId && (
                    <div className="mt-1">
                      <Badge tone="blue">
                        WP: {wpTitleById.get(ev.workingPaperId) ?? 'Working paper'}
                      </Badge>
                    </div>
                  )}
                  <EvidenceAssetLinks
                    evidenceId={ev.id}
                    engagementId={engagement.id}
                    canLink={canLinkAsset}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={documentsApi.downloadUrl(ev.documentId)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                  {canDispute && !ev.isDisputed && (
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<AlertOctagon className="h-3.5 w-3.5" />}
                      onClick={() => setDisputing(ev)}
                    >
                      Dispute
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ReasonDialog
        open={Boolean(disputing)}
        onClose={() => setDisputing(null)}
        onConfirm={async (reason) => {
          await dispute.mutateAsync({ id: disputing!.id, reason });
          setDisputing(null);
        }}
        title="Dispute evidence"
        description="Explain why this evidence is being disputed. The reason is recorded against the evidence record."
        placeholder="Reason for dispute…"
        confirmLabel="Dispute"
        tone="danger"
        isLoading={dispute.isPending}
      />
    </div>
  );
};

/**
 * Per-evidence asset links. Shows the assets this evidence item substantiates
 * as chips, and (for asset:link holders) lets you attach one of the engagement's
 * in-scope assets — surfacing the previously-orphaned evidence↔asset link.
 */
const EvidenceAssetLinks = ({
  evidenceId,
  engagementId,
  canLink,
}: {
  evidenceId: string;
  engagementId: string;
  canLink: boolean;
}): JSX.Element | null => {
  const qc = useQueryClient();
  const linked = useQuery({
    queryKey: ['evidence', evidenceId, 'assets'],
    queryFn: () => assetsApi.listForEvidence(evidenceId),
  });
  const scopeAssets = useQuery({
    queryKey: ['engagements', engagementId, 'assets'],
    queryFn: () => assetsApi.listForEngagement(engagementId),
    enabled: canLink,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['evidence', evidenceId, 'assets'] });
  const link = useMutation({
    mutationFn: (assetId: string) => assetsApi.linkToEvidence(assetId, evidenceId),
    onSuccess: () => { toast.success('Asset linked'); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to link asset'),
  });
  const unlink = useMutation({
    mutationFn: (assetId: string) => assetsApi.unlinkFromEvidence(assetId, evidenceId),
    onSuccess: () => { toast.success('Asset unlinked'); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to unlink asset'),
  });

  const linkedIds = new Set((linked.data ?? []).map((a) => a.id));
  const options = (scopeAssets.data ?? []).filter((a) => !linkedIds.has(a.id));

  if (!canLink && (!linked.data || linked.data.length === 0)) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {(linked.data ?? []).map((a) => (
        <span key={a.id} className="inline-flex items-center gap-1">
          <Link href={`/assets/${a.id}`}>
            <Badge tone="blue">{a.assetTag}</Badge>
          </Link>
          {canLink && (
            <button
              type="button"
              onClick={() => unlink.mutate(a.id)}
              className="text-[11px] text-text-muted hover:text-danger"
              title="Unlink asset"
            >
              ×
            </button>
          )}
        </span>
      ))}
      {canLink && options.length > 0 && (
        <Select
          value=""
          onChange={(e) => e.target.value && link.mutate(e.target.value)}
          className="h-6 w-40 text-[11px]"
        >
          <option value="">+ Link asset…</option>
          {options.map((a) => (
            <option key={a.id} value={a.id}>
              {a.assetTag} — {a.name}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
};
