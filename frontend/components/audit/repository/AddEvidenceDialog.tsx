'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, FileType2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/Button';
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox';
import { Input } from '@/components/ui/Input';
import { engagementsApi, evidenceApi } from '@/lib/api/audit';
import { formatFileSize } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface AddEvidenceDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Upload evidence to the central repository without first navigating into an
 * engagement. Evidence is always tied to an engagement, and the backend only
 * accepts uploads to engagements that are in progress — so the picker is
 * limited to in-progress engagements.
 */
export const AddEvidenceDialog = ({ open, onClose }: AddEvidenceDialogProps): JSX.Element | null => {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [engagementId, setEngagementId] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Reset state each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setEngagementId('');
    setDescription('');
    setFiles([]);
  }, [open]);

  const engagements = useQuery({
    queryKey: ['engagements', { status: 'in_progress', forUpload: true }],
    queryFn: () => engagementsApi.list({ status: 'in_progress', pageSize: 100 }),
    enabled: open,
  });

  const upload = useMutation({
    mutationFn: async () => {
      // Upload sequentially so a mid-batch failure still surfaces clearly.
      for (const file of files) {
        await evidenceApi.upload(engagementId, file, description.trim() || undefined);
      }
    },
    onSuccess: () => {
      toast.success(files.length > 1 ? `${files.length} files uploaded` : 'Evidence uploaded');
      qc.invalidateQueries({ queryKey: ['audit-repository'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to upload'),
  });

  // Escape to close (unless mid-flight).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !upload.isPending) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, upload.isPending, onClose]);

  if (!open) return null;

  const options: ComboboxOption[] = (engagements.data?.items ?? []).map((e) => ({
    value: e.id,
    label: e.title,
    hint: e.referenceNumber,
  }));

  const addFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(incoming)]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const canSubmit = Boolean(engagementId) && files.length > 0 && !upload.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in motion-reduce:animate-none"
      role="dialog"
      aria-modal="true"
      aria-label="Add evidence"
    >
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={() => !upload.isPending && onClose()}
        aria-hidden
      />
      <div className="relative w-full max-w-lg rounded-lg border border-border bg-white p-5 shadow-card-hover">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Add evidence</h2>
            <p className="mt-1 text-xs text-text-secondary">
              Files are attached to an engagement and added to the repository. Only in-progress engagements can receive evidence.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !upload.isPending && onClose()}
            className="-mr-1 -mt-1 rounded-md p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Engagement</label>
            <Combobox
              value={engagementId}
              onChange={setEngagementId}
              options={options}
              placeholder={engagements.isLoading ? 'Loading engagements…' : 'Select an engagement'}
              disabled={engagements.isLoading || upload.isPending}
              emptyText="No in-progress engagements available"
            />
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 px-4 text-center transition-colors',
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-border bg-surface-alt hover:border-primary hover:bg-primary/5',
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary">
              <Upload className="h-4 w-4" />
            </div>
            <p className="mt-2 text-sm font-medium text-text-primary">Click or drop files to upload</p>
            <p className="text-xs text-text-secondary">Any file type · up to 50 MB each</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {files.length > 0 && (
            <ul className="space-y-1.5">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 rounded-md border border-border bg-surface-alt px-3 py-2"
                >
                  <FileType2 className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary">{file.name}</p>
                    <p className="text-[11px] text-text-muted">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    disabled={upload.isPending}
                    className="rounded p-1 text-text-secondary hover:bg-surface-hover hover:text-danger disabled:cursor-not-allowed"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a short note about this evidence"
              disabled={upload.isPending}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => upload.mutate()}
            isLoading={upload.isPending}
            disabled={!canSubmit}
          >
            Upload
          </Button>
        </div>
      </div>
    </div>
  );
};
