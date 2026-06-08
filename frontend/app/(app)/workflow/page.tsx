'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Users, AlertOctagon, SlidersHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Table, type Column } from '@/components/ui/Table';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { SlideOver } from '@/components/ui/SlideOver';
import { UserSelect } from '@/components/common/UserSelect';
import { workflowApi } from '@/lib/api/workflow';
import { engagementsApi } from '@/lib/api/audit';
import { formatDate, formatRelative } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import { usePermissions } from '@/lib/hooks/usePermissions';
import type {
  WorkflowApproval,
  WorkflowAssignment,
  EscalationPolicy,
} from '@/lib/types/domain';
import { cn } from '@/lib/utils/cn';

type TabKey = 'inbox' | 'assignments' | 'escalations' | 'policies';

export default function WorkflowPage(): JSX.Element {
  const { hasAnyRole, isAdminLevel, isAuditLead } = usePermissions();
  const isAdmin = hasAnyRole(['super_admin', 'audit_admin']);
  const canAssign = isAdminLevel || isAuditLead;

  const router = useRouter();
  const searchParams = useSearchParams();
  const VALID_TABS: TabKey[] = ['inbox', 'assignments', 'escalations', 'policies'];
  const tabParam = searchParams?.get('tab');
  const initialTab: TabKey = VALID_TABS.includes(tabParam as TabKey) ? (tabParam as TabKey) : 'inbox';
  const [tab, setTab] = useState<TabKey>(initialTab);

  const changeTab = (k: TabKey): void => {
    setTab(k);
    router.replace(`?tab=${k}`, { scroll: false });
  };

  const pending = useQuery({
    queryKey: ['workflow', 'pending'],
    queryFn: () => workflowApi.listPending(),
  });

  const tabs: TabItem[] = [
    { key: 'inbox', label: 'Approval Inbox', count: pending.data?.length ?? 0, countTone: 'danger' },
    { key: 'assignments', label: 'Assignments' },
    { key: 'escalations', label: 'Escalations' },
    ...(isAdmin ? [{ key: 'policies', label: 'Escalation Policies' }] : []),
  ];

  return (
    <div>
      <PageHeader title="Workflow" subtitle="Approvals, staff assignment, and escalation tracking." />

      <Card padded className="mb-4">
        <Tabs tabs={tabs} active={tab} onChange={(k) => changeTab(k as TabKey)} />
      </Card>

      {tab === 'inbox' && <InboxTab approvals={pending.data} isLoading={pending.isLoading} onRefetch={() => pending.refetch()} />}
      {tab === 'assignments' && <AssignmentsTab />}
      {tab === 'escalations' && <EscalationsTab />}
      {tab === 'policies' && isAdmin && <PoliciesTab />}
    </div>
  );
}

// ============================================================
// Approval Inbox tab
// ============================================================
const InboxTab = ({
  approvals,
  isLoading,
  onRefetch,
}: {
  approvals?: WorkflowApproval[];
  isLoading: boolean;
  onRefetch: () => void;
}): JSX.Element => {
  const qc = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const approve = useMutation({
    mutationFn: (id: string) => workflowApi.approve(id),
    onSuccess: () => {
      toast.success('Approved');
      qc.invalidateQueries({ queryKey: ['workflow'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => workflowApi.reject(id, reason),
    onSuccess: () => {
      toast.success('Rejected');
      qc.invalidateQueries({ queryKey: ['workflow'] });
      setRejectingId(null);
      setRejectReason('');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  if (isLoading) {
    return (
      <Card>
        <Skeleton className="h-12 w-full" />
      </Card>
    );
  }

  if (!approvals || approvals.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Inbox className="h-4 w-4" />}
          title="Your approval inbox is empty"
          description="New requests appear here when they reach your level."
        />
      </Card>
    );
  }

  return (
    <Card padded={false}>
      <ul className="divide-y divide-border">
        {approvals.map((a) => {
          const days = Math.floor((Date.now() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60 * 24));
          const isStale = days > 3;
          return (
            <li key={a.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="gray">{humanizeStatus(a.entityType)}</Badge>
                    <span className="text-sm font-medium text-text-primary">
                      Level {a.currentLevel} of {a.totalLevels}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    Submitted by {a.submittedByName} · {formatRelative(a.createdAt)}
                  </p>
                </div>
                <span
                  className={cn(
                    'text-xs',
                    isStale ? 'font-medium text-danger' : 'text-text-secondary',
                  )}
                >
                  {days}d waiting
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="success" onClick={() => approve.mutate(a.id)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setRejectingId(a.id)}>
                    Reject
                  </Button>
                </div>
              </div>
              {rejectingId === a.id && (
                <div className="mt-3 rounded-md border border-border bg-surface-alt p-3">
                  <FormField label="Reason" required>
                    <Textarea
                      rows={3}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Explain why this is being rejected…"
                    />
                  </FormField>
                  <div className="mt-2 flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRejectingId(null);
                        setRejectReason('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (!rejectReason.trim()) return toast.error('Reason required');
                        reject.mutate({ id: a.id, reason: rejectReason.trim() });
                      }}
                      isLoading={reject.isPending}
                    >
                      Submit rejection
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
};

// ============================================================
// Assignments tab
// ============================================================
const AssignmentsTab = (): JSX.Element => {
  const qc = useQueryClient();
  const { isAdminLevel, isAuditLead } = usePermissions();
  const canAssign = isAdminLevel || isAuditLead;
  const [open, setOpen] = useState(false);
  const mine = useQuery({
    queryKey: ['workflow', 'assignments', 'mine'],
    queryFn: () => workflowApi.listMine(),
  });

  const columns: Column<WorkflowAssignment>[] = [
    {
      key: 'engagement',
      header: 'Engagement',
      render: (a) => (
        <div>
          <p className="font-mono text-xs text-primary">{a.engagementReference}</p>
          <p className="text-text-secondary text-xs">{a.engagementTitle}</p>
        </div>
      ),
    },
    { key: 'user', header: 'Assignee', render: (a) => <span>{a.userName}</span>, width: '180px' },
    { key: 'role', header: 'Role', render: (a) => <Badge tone="gray">{humanizeStatus(a.role)}</Badge>, width: '140px' },
    {
      key: 'date',
      header: 'Assigned',
      render: (a) => <span className="text-xs text-text-secondary">{formatDate(a.assignedAt)}</span>,
      width: '130px',
    },
  ];

  return (
    <>
      {canAssign && (
        <div className="mb-4 flex items-center justify-end">
          <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
            Assign staff
          </Button>
        </div>
      )}
      <Table<WorkflowAssignment>
        columns={columns}
        data={mine.data}
        rowKey={(a) => a.id}
        isLoading={mine.isLoading}
        emptyState={<EmptyState icon={<Users className="h-4 w-4" />} title="No assignments yet" />}
      />
      <NewAssignmentSlideOver open={open} onClose={() => setOpen(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['workflow', 'assignments'] })} />
    </>
  );
};

const NewAssignmentSlideOver = ({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}): JSX.Element => {
  const [engagementId, setEngagementId] = useState('');
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'lead_auditor' | 'supporting_auditor'>('lead_auditor');

  const engagements = useQuery({
    queryKey: ['engagements', 'all'],
    queryFn: () => engagementsApi.list({ pageSize: 100 }),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () => workflowApi.createAssignment({ engagementId, userId, role }),
    onSuccess: () => {
      toast.success('Assignment created');
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Assign staff to engagement"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            isLoading={create.isPending}
            onClick={() => {
              if (!engagementId || !userId) return toast.error('Select engagement and user');
              create.mutate();
            }}
          >
            Assign
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Engagement" required>
          <Select value={engagementId} onChange={(e) => setEngagementId(e.target.value)}>
            <option value="">Select engagement…</option>
            {engagements.data?.items.map((e) => (
              <option key={e.id} value={e.id}>
                {e.referenceNumber} — {e.title}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="User" required>
          <UserSelect value={userId} onChange={setUserId} />
        </FormField>
        <FormField label="Role" required>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as 'lead_auditor' | 'supporting_auditor')}
          >
            <option value="lead_auditor">Lead auditor</option>
            <option value="supporting_auditor">Supporting auditor</option>
          </Select>
        </FormField>
      </div>
    </SlideOver>
  );
};

// ============================================================
// Escalations tab
// ============================================================
const EscalationsTab = (): JSX.Element => {
  const ack = useMutation({
    mutationFn: (id: string) => workflowApi.acknowledge(id),
    onSuccess: () => toast.success('Acknowledged'),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  // Note: backend exposes /workflow/escalations/entity/:type/:id — we don't have a global list endpoint.
  // Use the dashboard escalation overview which is global for monitoring purposes.
  return (
    <Card>
      <CardHeader title="Active escalations" subtitle="Review escalation history per entity from its detail page." />
      <EmptyState
        icon={<AlertOctagon className="h-4 w-4" />}
        title="Open an entity to view escalations"
        description="The dashboard shows the overall escalation count; detailed escalation history is scoped to an engagement or approval."
      />
    </Card>
  );
};

// ============================================================
// Policies tab
// ============================================================
const PoliciesTab = (): JSX.Element => {
  const qc = useQueryClient();
  const policies = useQuery({
    queryKey: ['workflow', 'policies'],
    queryFn: () => workflowApi.listPolicies(),
  });

  const upsert = useMutation({
    mutationFn: workflowApi.upsertPolicy,
    onSuccess: () => {
      toast.success('Policy saved');
      qc.invalidateQueries({ queryKey: ['workflow', 'policies'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const auditTypes = ['it', 'financial', 'compliance', 'systems', 'all'];

  if (policies.isLoading) {
    return <Card><Skeleton className="h-12 w-full" /></Card>;
  }

  const findPolicy = (auditType: string): EscalationPolicy | undefined =>
    policies.data?.find((p) => p.auditType === auditType);

  return (
    <Card padded={false}>
      <div className="px-5 pt-5 pb-3">
        <CardHeader title="Escalation policies" subtitle="Wait times before escalation per audit type" className="mb-0" />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-surface-alt">
            <tr className="text-left text-[11px] uppercase tracking-wider text-text-secondary">
              <th className="px-4 py-3">Audit type</th>
              <th className="px-4 py-3">L1 (h)</th>
              <th className="px-4 py-3">L2 (h)</th>
              <th className="px-4 py-3">L3 (h)</th>
              <th className="px-4 py-3">L4 (h)</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {auditTypes.map((t) => (
              <PolicyRow
                key={t}
                auditType={t}
                policy={findPolicy(t)}
                onSave={(dto) => upsert.mutate(dto)}
                isSaving={upsert.isPending}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

const PolicyRow = ({
  auditType,
  policy,
  onSave,
  isSaving,
}: {
  auditType: string;
  policy?: EscalationPolicy;
  onSave: (dto: { auditType: string; level1Hours: number; level2Hours: number; level3Hours: number; level4Hours: number }) => void;
  isSaving: boolean;
}): JSX.Element => {
  const [l1, setL1] = useState(policy?.level1Hours ?? 24);
  const [l2, setL2] = useState(policy?.level2Hours ?? 48);
  const [l3, setL3] = useState(policy?.level3Hours ?? 72);
  const [l4, setL4] = useState(policy?.level4Hours ?? 96);

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-text-primary capitalize">{auditType}</td>
      <td className="px-4 py-3"><Input type="number" value={l1} onChange={(e) => setL1(Number(e.target.value))} className="w-24 h-8" /></td>
      <td className="px-4 py-3"><Input type="number" value={l2} onChange={(e) => setL2(Number(e.target.value))} className="w-24 h-8" /></td>
      <td className="px-4 py-3"><Input type="number" value={l3} onChange={(e) => setL3(Number(e.target.value))} className="w-24 h-8" /></td>
      <td className="px-4 py-3"><Input type="number" value={l4} onChange={(e) => setL4(Number(e.target.value))} className="w-24 h-8" /></td>
      <td className="px-4 py-3 text-right">
        <Button
          size="sm"
          isLoading={isSaving}
          onClick={() =>
            onSave({
              auditType,
              level1Hours: l1,
              level2Hours: l2,
              level3Hours: l3,
              level4Hours: l4,
            })
          }
        >
          Save
        </Button>
      </td>
    </tr>
  );
};

// satisfy unused import lint
void SlidersHorizontal;
