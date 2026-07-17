'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Table, type Column } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { SlideOver } from '@/components/ui/SlideOver';
import { UserSelect } from '@/components/common/UserSelect';
import { workflowApi } from '@/lib/api/workflow';
import { engagementsApi } from '@/lib/api/audit';
import { formatDate } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import { usePermissions } from '@/lib/hooks/usePermissions';
import type { WorkflowAssignment } from '@/lib/types/domain';

export default function AssignmentsPage(): JSX.Element {
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission } = usePermissions();
  const canAssign = hasPermission('assignment:create');
  const [open, setOpen] = useState(false);

  // The Assignments page is a management view: it must show the assignments the
  // user can act on (their engagements' staffing), not just their own personal
  // assignments — otherwise a manager who assigns staff sees an empty page.
  const mine = useQuery({
    queryKey: ['workflow', 'assignments', 'manageable'],
    queryFn: () => workflowApi.listManageable(),
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
    <div>
      <PageHeader title="Assignments" subtitle="Staff assigned to engagements." />

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
        onRowClick={(a) => router.push(`/audit/engagements/${a.engagementId}`)}
      />
      <NewAssignmentSlideOver
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['workflow', 'assignments'] })}
      />
    </div>
  );
}

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
          <Select value={role} onChange={(e) => setRole(e.target.value as 'lead_auditor' | 'supporting_auditor')}>
            <option value="lead_auditor">Lead auditor</option>
            <option value="supporting_auditor">Supporting auditor</option>
          </Select>
        </FormField>
      </div>
    </SlideOver>
  );
};
