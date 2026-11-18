'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, FilePlus2, LayoutTemplate, Trash2, Upload } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SlideOver } from '@/components/ui/SlideOver';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { workspaceApi, type WorkspaceDocumentSummary } from '@/lib/api/workspace';
import { formatRelative } from '@/lib/utils/format';

type Template = 'blank' | 'gbb';

const TEMPLATES: Array<{ value: Template; title: string; text: string }> = [
  { value: 'gbb', title: 'GBB template', text: 'The Galaxy Backbone cover, document information, change history and approval tables, ready to fill in. Everything stays editable.' },
  { value: 'blank', title: 'Blank page', text: 'An empty page. Write whatever you want, in any layout.' },
];

export default function WorkspacePage(): JSX.Element {
  const router = useRouter();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState<Template>('gbb');
  const [deleting, setDeleting] = useState<WorkspaceDocumentSummary | null>(null);

  const docs = useQuery({ queryKey: ['workspace', 'documents', search], queryFn: () => workspaceApi.list(search || undefined) });

  const create = useMutation({
    mutationFn: () => workspaceApi.create({ title: title.trim(), template }),
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ['workspace', 'documents'] });
      router.push(`/workspace/${doc.id}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not create the document'),
  });

  const importWord = useMutation({
    mutationFn: async (file: File) => {
      const imported = await workspaceApi.importWord(file);
      const doc = await workspaceApi.create({ title: imported.title || 'Imported document', template: 'blank', content: imported.html });
      return { doc, imported };
    },
    onSuccess: ({ doc, imported }) => {
      if (imported.warnings.length > 0) toast.warning(`Opened, but Word had things the editor can't show: ${imported.warnings[0]}`);
      qc.invalidateQueries({ queryKey: ['workspace', 'documents'] });
      router.push(`/workspace/${doc.id}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not import that file'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => workspaceApi.remove(id),
    onSuccess: () => {
      toast.success('Document deleted');
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['workspace', 'documents'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not delete'),
  });

  const items = docs.data ?? [];

  return (
    <div>
      <PageHeader
        title="My Documents"
        subtitle="Write and keep your own documents here, in a Word-style editor. Only you can see them."
        actions={
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importWord.mutate(f);
                e.target.value = '';
              }}
            />
            <Button variant="secondary" leftIcon={<Upload className="h-4 w-4" />} isLoading={importWord.isPending} onClick={() => fileRef.current?.click()}>
              Open a Word file
            </Button>
            <Button leftIcon={<FilePlus2 className="h-4 w-4" />} onClick={() => { setTitle(''); setNewOpen(true); }}>
              New document
            </Button>
          </div>
        }
      />

      <div className="mb-4 max-w-sm">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search my documents…" />
      </div>

      {docs.isLoading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title={search ? 'No documents match' : 'No documents yet'}
          description={search ? 'Try a different search.' : 'Start from the GBB template or a blank page, or open a Word file you already have.'}
          action={!search ? <Button onClick={() => { setTitle(''); setNewOpen(true); }}>New document</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((d) => (
            <Card key={d.id} padded className="group transition hover:border-primary">
              <div
                role="link"
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => router.push(`/workspace/${d.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && router.push(`/workspace/${d.id}`)}
              >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{d.title}</p>
                    <p className="mt-0.5 text-xs text-text-muted">Edited {formatRelative(d.updatedAt)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Delete ${d.title}`}
                  className="rounded p-1 text-text-muted opacity-0 hover:bg-surface-alt hover:text-danger group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); setDeleting(d); }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3">
                <Badge tone={d.template === 'gbb' ? 'green' : 'gray'}>{d.template === 'gbb' ? 'GBB template' : 'Blank page'}</Badge>
              </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SlideOver
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New document"
        description="Choose where to start. You can change anything afterwards."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={title.trim().length === 0} isLoading={create.isPending} onClick={() => create.mutate()}>
              Create
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Document title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Internal Audit Charter" autoFocus />
          </div>
          <div className="space-y-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTemplate(t.value)}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left ${template === t.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
              >
                <LayoutTemplate className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-semibold text-text-primary">{t.title}</span>
                  <span className="block text-xs text-text-secondary">{t.text}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this document?"
        description={deleting ? `"${deleting.title}" will be removed from your documents.` : undefined}
        confirmLabel="Delete"
        isLoading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}
