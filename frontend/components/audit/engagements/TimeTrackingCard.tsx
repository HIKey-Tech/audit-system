'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { timeEntriesApi } from '@/lib/api/audit';
import { formatDate } from '@/lib/utils/format';
import { usePermissions } from '@/lib/hooks/usePermissions';

const today = (): string => new Date().toISOString().slice(0, 10);

export const TimeTrackingCard = ({
  engagementId,
  isClosed,
}: {
  engagementId: string;
  isClosed: boolean;
}): JSX.Element => {
  const { user, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [entryDate, setEntryDate] = useState(today());
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');

  const summary = useQuery({
    queryKey: ['engagements', engagementId, 'time-entries'],
    queryFn: () => timeEntriesApi.list(engagementId),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['engagements', engagementId, 'time-entries'] });
    void queryClient.invalidateQueries({ queryKey: ['engagements', engagementId] });
  };

  const logMut = useMutation({
    mutationFn: () =>
      timeEntriesApi.log(engagementId, {
        entryDate,
        hours: Number(hours),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Time logged');
      setHours('');
      setDescription('');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to log time'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => timeEntriesApi.remove(id),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to delete entry'),
  });

  const data = summary.data;
  const planned = data?.plannedHours ?? null;
  const total = data?.totalHours ?? 0;
  const pct = planned && planned > 0 ? Math.min(100, Math.round((total / planned) * 100)) : null;
  const overBudget = planned != null && planned > 0 && total > planned;
  const hoursValid = Number(hours) > 0 && Number(hours) <= 24;

  return (
    <Card>
      <CardHeader
        title="Time tracking"
        subtitle={
          planned != null
            ? `${total} of ${planned} budgeted hours logged`
            : `${total} hours logged (no budget set)`
        }
      />

      {pct != null && (
        <div className="mb-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className={overBudget ? 'h-full bg-danger' : 'h-full bg-primary'}
              style={{ width: `${pct}%` }}
            />
          </div>
          {overBudget && (
            <p className="mt-1 text-xs text-danger">Over budget by {total - planned!} hours</p>
          )}
        </div>
      )}

      {!isClosed && (
        <form
          className="mb-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (hoursValid) logMut.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Date">
              <Input
                type="date"
                value={entryDate}
                max={today()}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Hours">
              <Input
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 4"
                required
              />
            </FormField>
          </div>
          <FormField label="Description" optional>
            <Input
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was worked on"
            />
          </FormField>
          <Button type="submit" size="sm" disabled={!hoursValid || logMut.isPending}>
            <Clock className="mr-1.5 h-4 w-4" />
            {logMut.isPending ? 'Logging…' : 'Log time'}
          </Button>
        </form>
      )}

      {data && data.entries.length > 0 ? (
        <ul className="max-h-64 space-y-1.5 overflow-y-auto">
          {data.entries.map((entry) => {
            const canDelete = entry.userId === user.id || hasPermission('engagement:read_all');
            return (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-text-primary">
                    {entry.userName} · {entry.hours}h
                  </p>
                  <p className="truncate text-text-muted">
                    {formatDate(entry.entryDate)}
                    {entry.description ? ` — ${entry.description}` : ''}
                  </p>
                </div>
                {canDelete && !isClosed && (
                  <button
                    type="button"
                    aria-label="Delete time entry"
                    className="shrink-0 text-text-muted transition-colors hover:text-danger"
                    onClick={() => deleteMut.mutate(entry.id)}
                    disabled={deleteMut.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-text-muted">No time logged yet.</p>
      )}
    </Card>
  );
};
