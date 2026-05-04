'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListChecks } from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/Card';
import { Select, Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { checklistsApi } from '@/lib/api/audit';
import { humanizeStatus } from '@/lib/utils/status';
import type { AuditEngagementDetail, AuditChecklistItem } from '@/lib/types/domain';

export const ChecklistsTab = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['engagements', engagement.id, 'checklists'],
    queryFn: () => checklistsApi.listByEngagement(engagement.id),
  });

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { result?: string; notes?: string } }) =>
      checklistsApi.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'checklists'] });
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, AuditChecklistItem[]>();
    (list.data ?? []).forEach((it) => {
      const key = it.auditType;
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [list.data]);

  const total = list.data?.length ?? 0;
  const passed = (list.data ?? []).filter((c) => c.result === 'passed').length;
  const failed = (list.data ?? []).filter((c) => c.result === 'failed').length;
  const tested = (list.data ?? []).filter((c) => c.result !== 'not_tested').length;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-text-primary">Checklists</h2>
        <p className="text-xs text-text-secondary">Control test register for this engagement.</p>
      </div>

      {list.isLoading ? (
        <Card>
          <Skeleton className="h-3 w-1/3 mb-3" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : !list.data || list.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListChecks className="h-4 w-4" />}
            title="No checklist items yet"
            description="A default control set is generated for the engagement audit type."
          />
        </Card>
      ) : (
        <>
          <Card className="mb-4">
            <div className="flex flex-wrap items-center gap-4">
              <ProgressBar
                tested={tested}
                passed={passed}
                failed={failed}
                total={total}
              />
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
                <span><span className="font-semibold text-success">{passed}</span> passed</span>
                <span><span className="font-semibold text-danger">{failed}</span> failed</span>
                <span><span className="font-semibold text-text-primary">{tested}</span> tested</span>
                <span><span className="font-semibold text-text-muted">{total - tested}</span> not tested</span>
              </div>
            </div>
          </Card>

          {grouped.map(([type, items]) => (
            <Card key={type} className="mb-4" padded={false}>
              <div className="border-b border-border bg-surface-alt px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  {humanizeStatus(type)} Audit
                </p>
              </div>
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs font-semibold text-text-primary">
                          {item.controlReference}
                        </p>
                        <p className="text-sm text-text-primary">{item.controlDescription}</p>
                        {item.testProcedure && (
                          <p className="mt-1 text-xs text-text-secondary">{item.testProcedure}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={item.result}
                          onChange={(e) => update.mutate({ id: item.id, dto: { result: e.target.value } })}
                          className="w-40 h-8 text-xs"
                        >
                          <option value="not_tested">Not tested</option>
                          <option value="passed">Passed</option>
                          <option value="failed">Failed</option>
                          <option value="not_applicable">Not applicable</option>
                        </Select>
                        <NotesInput
                          initial={item.notes ?? ''}
                          onSave={(v) => update.mutate({ id: item.id, dto: { notes: v } })}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </>
      )}
    </div>
  );
};

const NotesInput = ({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (v: string) => void;
}): JSX.Element => {
  const [value, setValue] = useState(initial);
  return (
    <Input
      value={value}
      placeholder="Notes…"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== initial) onSave(value);
      }}
      className="w-56 h-8 text-xs"
    />
  );
};

const ProgressBar = ({
  tested,
  passed,
  failed,
  total,
}: {
  tested: number;
  passed: number;
  failed: number;
  total: number;
}): JSX.Element => {
  if (total === 0) return <span className="text-xs text-text-muted">No items</span>;
  const passedPct = (passed / total) * 100;
  const failedPct = (failed / total) * 100;
  const otherTestedPct = ((tested - passed - failed) / total) * 100;

  return (
    <div className="flex-1 min-w-[240px]">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="bg-emerald-500" style={{ width: `${passedPct}%` }} />
        <div className="bg-red-500" style={{ width: `${failedPct}%` }} />
        <div className="bg-blue-400" style={{ width: `${otherTestedPct}%` }} />
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-text-muted">
        {Math.round((tested / total) * 100)}% tested
      </p>
    </div>
  );
};
