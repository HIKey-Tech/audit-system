'use client';

import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, FolderOpen, Download, History } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { SlideOver } from '@/components/ui/SlideOver';
import { documentsApi } from '@/lib/api/documents';
import { formatDate, formatFileSize } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import type { DocumentDto, DocumentVersionDto } from '@/lib/types/domain';

export default function DocumentsPage(): JSX.Element {
  const qc = useQueryClient();
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [versionsOf, setVersionsOf] = useState<DocumentDto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const list = useQuery({
    queryKey: ['documents', entityType, entityId],
    queryFn: () => {
      if (entityType && entityId) {
        return documentsApi.listByEntity(entityType, entityId);
      }
      return Promise.resolve([] as DocumentDto[]);
    },
    enabled: Boolean(entityType && entityId),
  });

  const upload = useMutation({
    mutationFn: (file: File) =>
      documentsApi.upload(file, {
        entityType: entityType || undefined,
        entityId: entityId || undefined,
      }),
    onSuccess: () => {
      toast.success('Document uploaded');
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to upload'),
  });

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Files attached to engagements, working papers, findings, and templates."
        actions={
          <Button leftIcon={<Upload className="h-4 w-4" />} onClick={() => inputRef.current?.click()}>
            Upload Document
          </Button>
        }
      />
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload.mutate(f);
          e.target.value = '';
        }}
      />

      <Card padded className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              Entity type
            </label>
            <Select
              className="mt-1"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              <option value="">Select…</option>
              <option value="audit_engagement">Engagement</option>
              <option value="audit_working_paper">Working paper</option>
              <option value="audit_finding">Finding</option>
              <option value="audit_evidence">Evidence</option>
              <option value="audit_report">Report</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              Entity ID
            </label>
            <Input
              className="mt-1"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="UUID of the parent entity"
            />
          </div>
        </div>
      </Card>

      <Card padded={false}>
        {!entityType || !entityId ? (
          <EmptyState
            icon={<FolderOpen className="h-4 w-4" />}
            title="Pick an entity to view its documents"
            description="Documents are scoped to a parent entity. Choose the entity type and paste an ID to browse files."
          />
        ) : list.isLoading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !list.data || list.data.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="h-4 w-4" />}
            title="No documents on this entity"
            description="Upload a file to attach it."
          />
        ) : (
          <ul className="divide-y divide-border">
            {list.data.map((d) => (
              <li key={d.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{d.fileName}</p>
                  <p className="text-[11px] text-text-muted">
                    {humanizeStatus(d.entityType ?? 'standalone')} · {formatFileSize(d.fileSize)} · {d.uploadedByName} · {formatDate(d.createdAt)}
                  </p>
                </div>
                <Badge tone="gray">v{d.versionNumber}</Badge>
                <a
                  href={documentsApi.downloadUrl(d.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<History className="h-3.5 w-3.5" />}
                  onClick={() => setVersionsOf(d)}
                >
                  Versions
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <VersionsSlideOver document={versionsOf} onClose={() => setVersionsOf(null)} />
    </div>
  );
}

const VersionsSlideOver = ({
  document,
  onClose,
}: {
  document: DocumentDto | null;
  onClose: () => void;
}): JSX.Element => {
  const versions = useQuery({
    queryKey: ['documents', document?.id, 'versions'],
    queryFn: () => documentsApi.listVersions(document!.id),
    enabled: Boolean(document),
  });

  return (
    <SlideOver
      open={Boolean(document)}
      onClose={onClose}
      title="Version history"
      description={document?.fileName}
      width="lg"
    >
      {!document ? null : versions.isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : !versions.data || versions.data.length === 0 ? (
        <p className="text-xs text-text-muted">No prior versions.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {(versions.data as DocumentVersionDto[]).map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
              <div>
                <p className="font-mono">v{v.versionNumber}</p>
                <p className="text-text-muted">{v.uploadedByName} · {formatDate(v.createdAt)}</p>
              </div>
              <span className="text-text-secondary">{formatFileSize(v.fileSize)}</span>
            </li>
          ))}
        </ul>
      )}
    </SlideOver>
  );
};
