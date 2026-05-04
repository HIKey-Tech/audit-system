'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, FileType2, Download, AlertOctagon } from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { evidenceApi } from '@/lib/api/audit';
import { documentsApi } from '@/lib/api/documents';
import { formatDate, formatFileSize } from '@/lib/utils/format';
import { useSession, hasAnyRole } from '@/components/providers/AuthProvider';
import { cn } from '@/lib/utils/cn';
import type { AuditEngagementDetail } from '@/lib/types/domain';

export const EvidenceTab = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const qc = useQueryClient();
  const session = useSession();
  const isAdmin = hasAnyRole(session, ['super_admin', 'audit_admin']);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const list = useQuery({
    queryKey: ['engagements', engagement.id, 'evidence'],
    queryFn: () => evidenceApi.listByEngagement(engagement.id),
  });

  const upload = useMutation({
    mutationFn: (file: File) => evidenceApi.upload(engagement.id, file),
    onSuccess: () => {
      toast.success('Evidence uploaded');
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'evidence'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to upload'),
  });

  const dispute = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      evidenceApi.dispute(id, reason),
    onSuccess: () => {
      toast.success('Evidence disputed');
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'evidence'] });
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
                  {isAdmin && !ev.isDisputed && (
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<AlertOctagon className="h-3.5 w-3.5" />}
                      onClick={() => {
                        const reason = window.prompt('Reason for disputing this evidence');
                        if (reason && reason.trim()) {
                          dispute.mutate({ id: ev.id, reason: reason.trim() });
                        }
                      }}
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
    </div>
  );
};
