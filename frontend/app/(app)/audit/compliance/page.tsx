'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, ShieldCheck, Library } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table, type Column } from '@/components/ui/Table';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Badge } from '@/components/ui/Badge';
import { SlideOver } from '@/components/ui/SlideOver';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePermission } from '@/hooks/usePermission';
import { complianceApi, type ComplianceControl, type CreateControlDto } from '@/lib/api/audit';
import { riskApi } from '@/lib/api/risk';
import { humanizeStatus } from '@/lib/utils/status';
import { cn } from '@/lib/utils/cn';
import { auditTypeLabel } from '@/lib/audit-domains';

const AUDIT_TYPES = ['it', 'financial', 'compliance'] as const;
const CATEGORIES = ['it', 'financial', 'compliance', 'governance'] as const;

export default function CompliancePage(): JSX.Element {
  const qc = useQueryClient();
  const canManage = usePermission('control:manage');

  const [search, setSearch] = useState('');
  const [frameworkId, setFrameworkId] = useState('');
  const [auditType, setAuditType] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ComplianceControl | null>(null);
  const [open, setOpen] = useState(false);

  const coverage = useQuery({ queryKey: ['compliance', 'coverage'], queryFn: () => complianceApi.coverage() });
  const tested = useQuery({ queryKey: ['compliance', 'tested'], queryFn: () => complianceApi.testedCoverage() });
  const riskCov = useQuery({ queryKey: ['compliance', 'risk-coverage'], queryFn: () => complianceApi.riskCoverage() });
  const frameworks = useQuery({ queryKey: ['compliance', 'frameworks'], queryFn: () => complianceApi.listFrameworks() });

  const controlsFilters = {
    page,
    pageSize: 20,
    search: search || undefined,
    frameworkId: frameworkId || undefined,
    auditType: auditType || undefined,
  };
  const controls = useQuery({
    queryKey: ['compliance', 'controls', controlsFilters],
    queryFn: () => complianceApi.listControls(controlsFilters),
  });

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (c: ComplianceControl) => {
    setEditing(c);
    setOpen(true);
  };
  const onSaved = () => {
    setOpen(false);
    qc.invalidateQueries({ queryKey: ['compliance'] });
  };

  const columns: Column<ComplianceControl>[] = [
    {
      key: 'ref',
      header: 'Reference',
      render: (c) => <span className="font-mono text-xs text-primary">{c.controlReference}</span>,
      width: '160px',
    },
    {
      key: 'framework',
      header: 'Framework',
      render: (c) => <Badge tone="gray">{c.frameworkCode ?? '—'}</Badge>,
      width: '130px',
    },
    {
      key: 'type',
      header: 'Audit type',
      render: (c) => <Badge tone="gray">{auditTypeLabel(c.auditType, 'short')}</Badge>,
      width: '120px',
    },
    {
      key: 'desc',
      header: 'Control',
      render: (c) => <span className="text-text-secondary line-clamp-2">{c.controlDescription}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => <Badge tone={c.isActive ? 'green' : 'gray'}>{c.isActive ? 'Active' : 'Retired'}</Badge>,
      width: '100px',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Control Library"
        subtitle="Control library and per-framework coverage across System/IT, financial, and compliance audits."
        actions={
          canManage ? (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              New control
            </Button>
          ) : null
        }
      />

      {/* Coverage summary */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card padded className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Frameworks</p>
            <p className="mt-1 text-2xl font-bold text-primary">{coverage.data?.totalFrameworks ?? 0}</p>
          </div>
          <Library className="h-5 w-5 text-primary" />
        </Card>
        <Card padded className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Total controls</p>
            <p className="mt-1 text-2xl font-bold text-primary">{coverage.data?.totalControls ?? 0}</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-primary" />
        </Card>
        <Card padded className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Active controls</p>
            <p className="mt-1 text-2xl font-bold text-primary">{coverage.data?.activeControls ?? 0}</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-primary" />
        </Card>
      </div>

      <Card padded className="mb-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Coverage by framework</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(coverage.data?.frameworks ?? []).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFrameworkId(f.id);
                setPage(1);
              }}
              className="rounded-lg border border-border bg-surface p-3 text-left hover:border-primary/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-primary">{f.code}</span>
                <Badge tone="gray">{f.activeControls}/{f.totalControls}</Badge>
              </div>
              <p className="mt-1 line-clamp-1 text-sm text-text-primary">{f.name}</p>
              <p className="mt-0.5 text-[11px] text-text-muted">{auditTypeLabel(f.category, 'short')}</p>
            </button>
          ))}
          {coverage.isLoading && <p className="text-sm text-text-muted">Loading coverage…</p>}
        </div>
      </Card>

      {/* Assurance coverage — controls actually exercised across engagements */}
      <Card padded className="mb-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Assurance coverage (tested)</p>
          <Badge tone={(tested.data?.coveragePct ?? 0) >= 75 ? 'green' : (tested.data?.coveragePct ?? 0) >= 40 ? 'amber' : 'gray'}>
            {tested.data?.coveragePct ?? 0}% overall · {tested.data?.testedControls ?? 0}/{tested.data?.totalControls ?? 0} controls
          </Badge>
        </div>
        <div className="space-y-2">
          {(tested.data?.frameworks ?? []).map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-2.5">
              <div className="w-28 shrink-0">
                <span className="font-mono text-xs font-semibold text-primary">{f.code}</span>
              </div>
              <div className="min-w-[140px] flex-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-alt">
                  <div
                    className={cn('h-full rounded-full', f.coveragePct >= 75 ? 'bg-emerald-500' : f.coveragePct >= 40 ? 'bg-amber-500' : 'bg-slate-400')}
                    style={{ width: `${f.coveragePct}%` }}
                  />
                </div>
              </div>
              <span className="w-24 shrink-0 text-right text-xs text-text-secondary">{f.testedControls}/{f.totalControls} tested</span>
              <div className="flex shrink-0 gap-1.5">
                <Badge tone="green">{f.passed} pass</Badge>
                <Badge tone="red">{f.failed} fail</Badge>
                {f.notApplicable > 0 && <Badge tone="gray">{f.notApplicable} N/A</Badge>}
              </div>
            </div>
          ))}
          {tested.isLoading && <p className="text-sm text-text-muted">Loading coverage…</p>}
          {!tested.isLoading && (tested.data?.frameworks.length ?? 0) === 0 && (
            <p className="text-sm text-text-muted">No controls defined yet.</p>
          )}
        </div>
      </Card>

      {/* Risk coverage — which register risks have control coverage (ISO 31000 / COBIT) */}
      <Card padded className="mb-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Risk coverage</p>
          <div className="flex gap-1.5">
            <Badge tone="green">{riskCov.data?.coveredRisks ?? 0} covered</Badge>
            <Badge tone={(riskCov.data?.uncoveredRisks ?? 0) > 0 ? 'red' : 'gray'}>
              {riskCov.data?.uncoveredRisks ?? 0} uncovered
            </Badge>
          </div>
        </div>
        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {(riskCov.data?.risks ?? []).map((r) => {
            const uncovered = r.mappedControls === 0;
            return (
              <div
                key={r.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-lg border p-2.5',
                  uncovered ? 'border-danger/40 bg-danger/5' : 'border-border bg-surface',
                )}
              >
                <Badge tone="gray">{r.currentScore}</Badge>
                <div className="min-w-[160px] flex-1">
                  <p className="line-clamp-1 text-sm font-medium text-text-primary">{r.title}</p>
                  <p className="text-[11px] text-text-muted">{r.category ?? '—'} · {humanizeStatus(r.status)}</p>
                </div>
                {uncovered ? (
                  <Badge tone="red">No controls</Badge>
                ) : (
                  <div className="flex gap-1.5">
                    <Badge tone="gray">{r.mappedControls} mapped</Badge>
                    <Badge tone={r.testedControls > 0 ? 'green' : 'amber'}>{r.testedControls} tested</Badge>
                  </div>
                )}
              </div>
            );
          })}
          {riskCov.isLoading && <p className="text-sm text-text-muted">Loading risk coverage…</p>}
          {!riskCov.isLoading && (riskCov.data?.risks.length ?? 0) === 0 && (
            <p className="text-sm text-text-muted">No risks in the register yet.</p>
          )}
        </div>
      </Card>

      {/* Controls library */}
      <Card padded className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            placeholder="Search controls…"
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={frameworkId}
            onChange={(e) => {
              setFrameworkId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All frameworks</option>
            {(frameworks.data ?? []).map((f) => (
              <option key={f.id} value={f.id}>{f.code} — {f.name}</option>
            ))}
          </Select>
          <Select
            value={auditType}
            onChange={(e) => {
              setAuditType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All audit types</option>
            {AUDIT_TYPES.map((t) => (
              <option key={t} value={t}>{humanizeStatus(t)}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Table<ComplianceControl>
        columns={columns}
        data={controls.data?.items}
        rowKey={(r) => r.id}
        isLoading={controls.isLoading}
        isError={controls.isError}
        onRetry={() => controls.refetch()}
        onRowClick={canManage ? openEdit : undefined}
        emptyState={
          <EmptyState
            icon={<ShieldCheck className="h-4 w-4" />}
            title="No controls found"
            description={canManage ? 'Create a control to build the framework library.' : 'No controls match these filters.'}
            action={
              canManage ? (
                <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={openCreate}>
                  New control
                </Button>
              ) : undefined
            }
          />
        }
        pagination={
          controls.data
            ? {
                page: controls.data.meta.page,
                pageSize: controls.data.meta.pageSize,
                total: controls.data.meta.total,
                onPageChange: setPage,
              }
            : undefined
        }
      />

      {canManage && (
        <ControlSlideOver
          open={open}
          onClose={() => setOpen(false)}
          editing={editing}
          frameworks={(frameworks.data ?? []).map((f) => ({ id: f.id, label: `${f.code} — ${f.name}` }))}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

interface ControlSlideOverProps {
  open: boolean;
  onClose: () => void;
  editing: ComplianceControl | null;
  frameworks: Array<{ id: string; label: string }>;
  onSaved: () => void;
}

function ControlSlideOver({ open, onClose, editing, frameworks, onSaved }: ControlSlideOverProps): JSX.Element {
  const qc = useQueryClient();
  const initial = useMemo(
    () => ({
      frameworkId: editing?.frameworkId ?? '',
      controlReference: editing?.controlReference ?? '',
      auditType: editing?.auditType ?? 'compliance',
      controlDescription: editing?.controlDescription ?? '',
      testProcedure: editing?.testProcedure ?? '',
      isActive: editing?.isActive ?? true,
    }),
    [editing],
  );
  const [form, setForm] = useState(initial);
  const [newFramework, setNewFramework] = useState(false);
  const [fwCode, setFwCode] = useState('');
  const [fwName, setFwName] = useState('');
  const [fwCategory, setFwCategory] = useState<string>('compliance');

  // Reset when (re)opened or the edited row changes.
  useMemo(() => {
    if (open) {
      setForm(initial);
      setNewFramework(false);
      setFwCode('');
      setFwName('');
      setFwCategory('compliance');
    }
  }, [open, initial]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      let frameworkId = form.frameworkId;
      if (newFramework) {
        const fw = await complianceApi.createFramework({ code: fwCode.trim(), name: fwName.trim(), category: fwCategory });
        frameworkId = fw.id;
        qc.invalidateQueries({ queryKey: ['compliance', 'frameworks'] });
      }
      const payload: CreateControlDto = {
        frameworkId,
        controlReference: form.controlReference.trim(),
        controlDescription: form.controlDescription.trim(),
        testProcedure: form.testProcedure.trim(),
        auditType: form.auditType,
        isActive: form.isActive,
      };
      if (editing) {
        await complianceApi.updateControl(editing.id, payload);
      } else {
        await complianceApi.createControl(payload);
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Control updated' : 'Control created');
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to save control'),
  });

  const retire = useMutation({
    mutationFn: () => complianceApi.deleteControl(editing!.id),
    onSuccess: () => {
      toast.success('Control retired');
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to retire control'),
  });

  const valid =
    (newFramework ? fwCode.trim().length >= 2 && fwName.trim().length >= 2 : Boolean(form.frameworkId)) &&
    form.controlReference.trim().length >= 1 &&
    form.controlDescription.trim().length >= 1 &&
    form.testProcedure.trim().length >= 1;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={editing ? 'Edit control' : 'New control'}
      description="Controls belong to a framework and an audit type, and feed coverage reporting."
      width="xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          {editing ? (
            <Button variant="ghost" size="sm" onClick={() => retire.mutate()} isLoading={retire.isPending}>
              Retire
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={() => save.mutate()} isLoading={save.isPending} disabled={!valid}>
              {editing ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {!newFramework ? (
          <FormField label="Framework" required>
            <Select value={form.frameworkId} onChange={(e) => set('frameworkId', e.target.value)}>
              <option value="">Select framework…</option>
              {frameworks.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </Select>
            <button type="button" className="mt-1 text-xs font-medium text-primary underline" onClick={() => setNewFramework(true)}>
              ＋ Create new framework
            </button>
          </FormField>
        ) : (
          <div className="space-y-3 rounded-lg border border-border bg-surface-alt p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">New framework</p>
              <button type="button" className="text-xs text-primary underline" onClick={() => setNewFramework(false)}>
                Use existing
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Code" required>
                <Input value={fwCode} onChange={(e) => setFwCode(e.target.value)} placeholder="e.g. ISO27017" />
              </FormField>
              <FormField label="Category" required>
                <Select value={fwCategory} onChange={(e) => setFwCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{humanizeStatus(c)}</option>
                  ))}
                </Select>
              </FormField>
            </div>
            <FormField label="Name" required>
              <Input value={fwName} onChange={(e) => setFwName(e.target.value)} placeholder="Framework name" />
            </FormField>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Control reference" required>
            <Input value={form.controlReference} onChange={(e) => set('controlReference', e.target.value)} placeholder="e.g. ISO27001-A.5.15" />
          </FormField>
          <FormField label="Audit type" required>
            <Select value={form.auditType} onChange={(e) => set('auditType', e.target.value)}>
              {AUDIT_TYPES.map((t) => (
                <option key={t} value={t}>{humanizeStatus(t)}</option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField label="Control description" required>
          <Textarea rows={3} value={form.controlDescription} onChange={(e) => set('controlDescription', e.target.value)} />
        </FormField>
        <FormField label="Test procedure" required>
          <Textarea rows={3} value={form.testProcedure} onChange={(e) => set('testProcedure', e.target.value)} />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
          Active
        </label>

        {editing && <ControlRiskLinks controlId={editing.id} />}
      </div>
    </SlideOver>
  );
}

function ControlRiskLinks({ controlId }: { controlId: string }): JSX.Element {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const linked = useQuery({
    queryKey: ['compliance', 'control-risks', controlId],
    queryFn: () => complianceApi.listControlRisks(controlId),
  });
  const risks = useQuery({
    queryKey: ['risks', 'picker', search],
    queryFn: () => riskApi.list({ pageSize: 20, search: search || undefined }),
    enabled: search.trim().length > 0,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['compliance', 'control-risks', controlId] });
    qc.invalidateQueries({ queryKey: ['compliance', 'risk-coverage'] });
  };
  const link = useMutation({
    mutationFn: (riskId: string) => complianceApi.linkRisk(controlId, riskId),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to map risk'),
  });
  const unlink = useMutation({
    mutationFn: (riskId: string) => complianceApi.unlinkRisk(controlId, riskId),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to remove mapping'),
  });

  const linkedIds = new Set((linked.data ?? []).map((r) => r.riskId));
  const candidates = (risks.data?.items ?? []).filter((r) => !linkedIds.has(r.id));

  return (
    <div className="rounded-lg border border-border bg-surface-alt p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Mitigates risks</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {(linked.data ?? []).map((r) => (
          <span key={r.riskId} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {r.title}
            <button type="button" onClick={() => unlink.mutate(r.riskId)} className="text-primary/70 hover:text-primary" aria-label="Remove">×</button>
          </span>
        ))}
        {(linked.data?.length ?? 0) === 0 && <span className="text-xs text-text-muted">No risks mapped yet.</span>}
      </div>
      <Input placeholder="Search risks to map…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {search.trim().length > 0 && (
        <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
          {candidates.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => link.mutate(r.id)}
              className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-2 py-1.5 text-left text-sm hover:border-primary/40"
            >
              <span className="line-clamp-1">{r.title}</span>
              <Badge tone="gray">{r.currentScore}</Badge>
            </button>
          ))}
          {risks.isFetched && candidates.length === 0 && <p className="text-xs text-text-muted">No matching risks.</p>}
        </div>
      )}
    </div>
  );
}
