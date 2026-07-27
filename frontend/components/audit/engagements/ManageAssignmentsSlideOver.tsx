'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserPlus, Trash2, Award, Briefcase, Activity, Check, Search } from 'lucide-react';
import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Select, Input } from '@/components/ui/Input';
import { workflowApi } from '@/lib/api/workflow';
import { initialsFromName } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import { usePermission } from '@/hooks/usePermission';
import type { AuditEngagementDetail } from '@/lib/types/domain';

interface Props {
  open: boolean;
  onClose: () => void;
  engagement: AuditEngagementDetail;
}

export const ManageAssignmentsSlideOver = ({ open, onClose, engagement }: Props): JSX.Element => {
  const qc = useQueryClient();
  const canCreate = usePermission('assignment:create');
  const canDelete = usePermission('assignment:delete');

  const [roleToAssign, setRoleToAssign] = useState<Record<string, 'lead_auditor' | 'supporting_auditor'>>({});

  // Server-side candidate search: the backend filters + caps the list, so we don't
  // pull the whole directory. Debounce so typing doesn't fire a request per keystroke.
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Query: get current assignments
  const assignments = useQuery({
    queryKey: ['engagements', engagement.id, 'assignments'],
    queryFn: () => workflowApi.listByEngagement(engagement.id),
    enabled: open,
  });

  // Query: get matching candidates (skill-ranked among the loaded page)
  const candidates = useQuery({
    queryKey: ['engagements', engagement.id, 'candidates', debouncedSearch],
    queryFn: () => workflowApi.getCandidates(engagement.id, { search: debouncedSearch || undefined, limit: 50 }),
    enabled: open,
  });

  // Mutation: assign staff
  const assign = useMutation({
    mutationFn: (dto: { userId: string; role: 'lead_auditor' | 'supporting_auditor' }) =>
      workflowApi.createAssignment({
        engagementId: engagement.id,
        userId: dto.userId,
        role: dto.role,
      }),
    onSuccess: (_, variables) => {
      toast.success('Staff assigned successfully');
      // Remove local role selection
      setRoleToAssign((prev) => {
        const next = { ...prev };
        delete next[variables.userId];
        return next;
      });
      // Invalidate queries
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'assignments'] });
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'candidates'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to assign staff'),
  });

  // Mutation: remove staff
  const remove = useMutation({
    mutationFn: (id: string) => workflowApi.removeAssignment(id),
    onSuccess: () => {
      toast.success('Assignment removed');
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'assignments'] });
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'candidates'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to remove assignment'),
  });

  // Candidates arrive already scored and ranked by the backend
  // (skill fit + workload + engagement priority).
  const sortedCandidates = candidates.data ?? [];

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Manage assignments"
      description={`Assign auditors to "${engagement.title}" based on skill matching.`}
      width="xl"
    >
      <div className="space-y-6">
        {/* Section: Current Assignments */}
        <div>
          <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3">
            Currently Assigned Staff ({assignments.data?.length ?? 0})
          </h3>
          {assignments.isLoading ? (
            <p className="text-xs text-text-muted">Loading assignments…</p>
          ) : !assignments.data || assignments.data.length === 0 ? (
            <p className="text-xs text-text-muted bg-surface-alt p-3 rounded-md">
              No staff members are assigned yet.
            </p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden bg-surface">
              <ul className="divide-y divide-border">
                {assignments.data.map((a) => (
                  <li key={a.id} className="flex items-center justify-between p-3.5 hover:bg-surface-alt/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar
                        initials={initialsFromName(undefined, undefined, a.userName)}
                        size="md"
                        tone="slate"
                      />
                      <div>
                        <p className="text-xs font-semibold text-text-primary">{a.userName}</p>
                        <p className="text-[11px] text-text-secondary font-medium">
                          Role: <span className="font-semibold text-primary">{humanizeStatus(a.role)}</span>
                        </p>
                      </div>
                    </div>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:text-red-700 hover:bg-red-50 border border-red-100 hover:border-red-200"
                        leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => remove.mutate(a.id)}
                        isLoading={remove.isPending}
                      >
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Section: Skill-Based Candidates Recommender */}
        <div>
          <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-1">
            Available Candidates (Skill-Based Recommender)
          </h3>
          <p className="text-[11px] text-text-secondary mb-3">
            Candidates are ranked by expertise matching the audit type: <strong className="text-primary uppercase">{engagement.auditType}</strong>.
            Search by name, email, or department to find anyone specific.
          </p>

          <div className="mb-3">
            <Input
              leftIcon={<Search className="h-4 w-4" />}
              placeholder="Search staff by name, email, or department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {candidates.isLoading ? (
            <p className="text-xs text-text-muted">Loading candidates…</p>
          ) : sortedCandidates.length === 0 ? (
            <p className="text-xs text-text-muted bg-surface-alt p-3 rounded-md">
              {debouncedSearch
                ? `No unassigned staff match "${debouncedSearch}".`
                : 'All active staff members are already assigned to this engagement.'}
            </p>
          ) : (
            <div className="space-y-3">
              {sortedCandidates.map((c) => {
                const assignedRole = roleToAssign[c.id] ?? 'supporting_auditor';

                // Color workloads
                let workloadTone: 'green' | 'blue' | 'red' = 'green';
                if (c.overCapacity || c.activeEngagementCount >= 3) workloadTone = 'red';
                else if (c.activeEngagementCount > 0) workloadTone = 'blue';

                return (
                  <div
                    key={c.id}
                    className="p-4 border border-border hover:border-primary/50 bg-surface rounded-lg shadow-sm hover:shadow-md transition-all duration-300 grid grid-cols-1 md:grid-cols-3 gap-4 items-start"
                  >
                    {/* Col 1: Candidate Basic Info */}
                    <div className="md:col-span-1 flex items-start gap-2.5">
                      <Avatar
                        initials={initialsFromName(undefined, undefined, c.displayName)}
                        size="md"
                        tone={c.matchedSkills.length > 0 ? 'navy' : 'slate'}
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-text-primary truncate" title={c.displayName}>
                          {c.displayName}
                        </h4>
                        {c.jobTitle && (
                          <p className="text-[11px] text-text-secondary flex items-center gap-1 mt-0.5">
                            <Briefcase className="h-3 w-3 shrink-0" />
                            <span className="truncate">{c.jobTitle}</span>
                          </p>
                        )}
                        {c.department && (
                          <p className="text-[11px] text-text-secondary flex items-center gap-1 mt-0.5">
                            <Activity className="h-3 w-3 shrink-0" />
                            <span className="truncate">{c.department}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Col 2: Skills & Workload Match */}
                    <div className="md:col-span-1 space-y-2">
                      {/* Workload Count */}
                      <div className="flex items-center gap-1.5">
                        <Badge tone={workloadTone}>
                          {c.activeEngagementCount === 0 
                            ? 'Available (0 active)' 
                            : `${c.activeEngagementCount} active audit${c.activeEngagementCount > 1 ? 's' : ''}`}
                        </Badge>
                        {c.recommended && (
                          <Badge tone="purple" className="flex items-center gap-0.5">
                            <Award className="h-3 w-3" /> Recommended
                          </Badge>
                        )}
                        {c.overCapacity && (
                          <Badge tone="red">At capacity</Badge>
                        )}
                      </div>

                      {/* Skills Tags */}
                      {c.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.skills.map((s) => {
                            const isMatch = c.matchedSkills.includes(s);
                            return (
                              <span
                                key={s}
                                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${isMatch ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-slate-100 text-slate-500'}`}
                              >
                                {s}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] italic text-text-muted">No skills listed</p>
                      )}
                    </div>

                    {/* Col 3: Quick Action Assignment */}
                    <div className="md:col-span-1 flex flex-col gap-2">
                      {canCreate ? (
                        <>
                          <div className="flex items-center gap-1">
                            <label className="text-[11px] font-bold text-text-secondary uppercase">Role:</label>
                            <Select
                              className="py-0.5 text-xs h-7"
                              value={assignedRole}
                              onChange={(e) =>
                                setRoleToAssign((prev) => ({
                                  ...prev,
                                  [c.id]: e.target.value as any,
                                }))
                              }
                            >
                              <option value="supporting_auditor">Supporting Auditor</option>
                              <option value="lead_auditor">Lead Auditor</option>
                            </Select>
                          </div>
                          <Button
                            size="sm"
                            className="w-full text-xs py-1"
                            leftIcon={<UserPlus className="h-3.5 w-3.5" />}
                            onClick={() =>
                              assign.mutate({
                                userId: c.id,
                                role: assignedRole,
                              })
                            }
                            isLoading={assign.isPending && assign.variables?.userId === c.id}
                          >
                            Assign Staff
                          </Button>
                        </>
                      ) : (
                        <p className="text-[11px] italic text-text-muted text-center py-2">
                          No assignment permission
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SlideOver>
  );
};
