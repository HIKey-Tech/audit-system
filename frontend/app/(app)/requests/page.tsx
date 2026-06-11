'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Inbox,
  Send,
  Plus,
  Paperclip,
  ArrowUp,
  ArrowDown,
  X,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Input, Textarea } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { SlideOver } from '@/components/ui/SlideOver';
import { requestsApi } from '@/lib/api/workflow';
import { formatRelative, formatFileSize } from '@/lib/utils/format';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { cn } from '@/lib/utils/cn';
import type { RequestCandidate, WorkflowRequest } from '@/lib/types/domain';

type TabKey = 'inbox' | 'mine';

export default function RequestsPage(): JSX.Element {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('request:create');
  const [tab, setTab] = useState<TabKey>('inbox');
  const [createOpen, setCreateOpen] = useState(false);

  const inbox = useQuery({
    queryKey: ['requests', 'inbox'],
    queryFn: () => requestsApi.inbox({ pageSize: 100 }),
  });
  const mine = useQuery({
    queryKey: ['requests', 'mine'],
    queryFn: () => requestsApi.list({ role: 'initiated', pageSize: 100 }),
    enabled: tab === 'mine',
  });

  const tabs: TabItem[] = [
    { key: 'inbox', label: 'To action', count: inbox.data?.items.length ?? 0, countTone: 'danger' },
    { key: 'mine', label: 'My requests' },
  ];

  const active = tab === 'inbox' ? inbox : mine;

  return (
    <div>
      <PageHeader
        title="Requests"
        subtitle="Ad-hoc approval, sign-off, or review requests between colleagues. For approving audit records, see Audit Approvals."
        actions={
          canCreate ? (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
              New request
            </Button>
          ) : undefined
        }
      />

      <Card padded className="mb-4">
        <Tabs tabs={tabs} active={tab} onChange={(k) => setTab(k as TabKey)} />
      </Card>

      {active.isLoading ? (
        <Card>
          <ListSkeleton rows={4} />
        </Card>
      ) : !active.data || active.data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={tab === 'inbox' ? <Inbox className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            title={tab === 'inbox' ? 'Nothing needs your action' : 'You have not sent any requests'}
            description={
              tab === 'inbox'
                ? 'Requests addressed to you appear here when it is your turn to act.'
                : 'Use “New request” to send a document or note for approval or sign-off.'
            }
          />
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-border">
            {active.data.items.map((r) => (
              <RequestRow key={r.id} request={r} showRecipient={tab === 'mine'} />
            ))}
          </ul>
        </Card>
      )}

      <CreateRequestSlideOver open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

const RequestRow = ({
  request,
  showRecipient,
}: {
  request: WorkflowRequest;
  showRecipient: boolean;
}): JSX.Element => {
  const currentStep = request.steps?.find((s) => s.level === request.currentLevel);
  const totalSteps = request.steps?.length ?? 0;
  return (
    <li>
      <Link
        href={`/requests/${request.id}`}
        className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-alt cursor-pointer"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-primary">{request.referenceNumber}</span>
            <StatusBadge status={request.status} withDot />
          </div>
          <p className="mt-1 truncate text-sm font-medium text-text-primary">{request.title}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {showRecipient
              ? `Step ${request.currentLevel} of ${totalSteps}${currentStep?.recipient ? ` · with ${currentStep.recipient.displayName}` : ''}`
              : `From ${request.initiator?.displayName ?? 'someone'}`}
            {' · '}
            {formatRelative(request.createdAt)}
          </p>
        </div>
        {(request.attachments?.length ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
            <Paperclip className="h-3.5 w-3.5" />
            {request.attachments?.length}
          </span>
        )}
      </Link>
    </li>
  );
};

// ============================================================
// Create request — single step, attachments optional
// ============================================================
interface CreateResult {
  id: string;
  reference: string;
  attached: number;
  failed: number;
}

const CreateRequestSlideOver = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): JSX.Element => {
  const router = useRouter();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<RequestCandidate[]>([]);
  const [search, setSearch] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<CreateResult | null>(null);

  const reset = () => {
    setTitle('');
    setDescription('');
    setSelected([]);
    setSearch('');
    setFiles([]);
    setResult(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const candidates = useQuery({
    queryKey: ['requests', 'candidates'],
    queryFn: () => requestsApi.candidates(),
    enabled: open,
  });

  const available = useMemo(() => {
    const chosen = new Set(selected.map((s) => s.id));
    const q = search.trim().toLowerCase();
    return (candidates.data ?? [])
      .filter((c) => !chosen.has(c.id))
      .filter((c) => !q || c.displayName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      .slice(0, 8);
  }, [candidates.data, selected, search]);

  const submit = useMutation({
    mutationFn: async (): Promise<CreateResult> => {
      const req = await requestsApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        recipientIds: selected.map((s) => s.id),
      });
      let attached = 0;
      let failed = 0;
      // Attachments are optional — upload any selected files after the request exists.
      for (const file of files) {
        try {
          await requestsApi.addAttachment(req.id, file);
          attached += 1;
        } catch {
          failed += 1;
        }
      }
      return { id: req.id, reference: req.referenceNumber, attached, failed };
    },
    onSuccess: (res) => {
      setResult(res);
      qc.invalidateQueries({ queryKey: ['requests'] });
      if (res.failed > 0) toast.warning(`Request created, but ${res.failed} attachment(s) failed to upload`);
      else toast.success('Request created');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to create request'),
  });

  const move = (index: number, dir: -1 | 1) => {
    setSelected((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const canSubmit = title.trim().length > 0 && selected.length > 0 && !submit.isPending;

  return (
    <SlideOver
      open={open}
      onClose={close}
      title={result ? 'Request sent' : 'New request'}
      description={
        result ? undefined : 'Pick recipients in the order they should act. Attachments are optional.'
      }
      footer={
        result ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={close}>
              Done
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const id = result.id;
                close();
                router.push(`/requests/${id}`);
              }}
            >
              Open request
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button size="sm" isLoading={submit.isPending} disabled={!canSubmit} onClick={() => submit.mutate()}>
              Create request
            </Button>
          </div>
        )
      }
    >
      {result ? (
        <div className="flex flex-col items-center py-6 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-success">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-sm text-text-secondary">Your request has been sent. Its reference number is</p>
          <p className="mt-1 font-mono text-lg font-semibold text-primary">{result.reference}</p>
          <p className="mt-3 text-xs text-text-secondary">
            {result.attached > 0
              ? `${result.attached} attachment(s) uploaded.`
              : 'No attachments.'}
            {' '}The first recipient has been notified.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <FormField label="Title" required>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Approve Q2 budget memo"
              maxLength={200}
            />
          </FormField>

          <FormField label="Description">
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add context for the recipients…"
              maxLength={5000}
            />
          </FormField>

          <FormField label="Recipients (in order)" required>
            {selected.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-text-secondary">
                No recipients yet. Add people below — they act one after another.
              </p>
            ) : (
              <ol className="space-y-1.5">
                {selected.map((c, i) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-primary">{c.displayName}</p>
                      <p className="truncate text-[11px] text-text-secondary">{c.email}</p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                        className="rounded p-1 text-text-secondary hover:bg-surface-alt disabled:opacity-30 cursor-pointer disabled:cursor-default"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={i === selected.length - 1}
                        onClick={() => move(i, 1)}
                        className="rounded p-1 text-text-secondary hover:bg-surface-alt disabled:opacity-30 cursor-pointer disabled:cursor-default"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => setSelected((prev) => prev.filter((s) => s.id !== c.id))}
                        className="rounded p-1 text-text-secondary hover:bg-red-50 hover:text-danger cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search people to add…"
              />
              {candidates.isLoading ? (
                <p className="mt-2 text-xs text-text-secondary">Loading people…</p>
              ) : available.length > 0 ? (
                <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto scrollbar-thin">
                  {available.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected((prev) => [...prev, c]);
                          setSearch('');
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-surface-alt cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-text-primary">{c.displayName}</span>
                          <span className="block truncate text-[11px] text-text-secondary">
                            {c.jobTitle ? `${c.jobTitle} · ` : ''}
                            {c.email}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-text-secondary">No matching people.</p>
              )}
            </div>
          </FormField>

          <FormField label="Attachments (optional)">
            <label
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-4 py-6 text-center transition-colors hover:border-primary hover:bg-surface-alt',
                submit.isPending && 'pointer-events-none opacity-60',
              )}
            >
              <Paperclip className="h-5 w-5 text-text-secondary" />
              <span className="text-sm font-medium text-text-primary">Click to attach files or images</span>
              <span className="text-xs text-text-secondary">PDF, images, Office docs — up to 50 MB each</span>
              <input
                type="file"
                multiple
                className="hidden"
                disabled={submit.isPending}
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  if (list.length) setFiles((prev) => [...prev, ...list]);
                  e.target.value = '';
                }}
              />
            </label>

            {files.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-text-secondary" />
                    <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{f.name}</span>
                    <span className="text-xs text-text-secondary">{formatFileSize(f.size)}</span>
                    <button
                      type="button"
                      aria-label="Remove file"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="rounded p-1 text-text-secondary hover:bg-red-50 hover:text-danger cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </FormField>
        </div>
      )}
    </SlideOver>
  );
};
