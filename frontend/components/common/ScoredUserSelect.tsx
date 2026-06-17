'use client';

import { useQuery } from '@tanstack/react-query';
import { Select } from '@/components/ui/Input';
import { engagementsApi } from '@/lib/api/audit';

interface ScoredUserSelectProps {
  value?: string;
  onChange: (value: string) => void;
  /** Which engagement slot this picker fills — drives the required-permission filter. */
  role: 'lead_auditor' | 'audit_manager';
  /** Engagement audit type — enables skill-fit scoring when known. */
  auditType?: string;
  /** Engagement priority — weights workload in the ranking when known. */
  priority?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  id?: string;
  excludeIds?: string[];
}

/**
 * User picker for the lead-auditor / audit-manager slots. Unlike the generic
 * UserSelect, it lists only permission-eligible users and orders them by the
 * backend's resource-optimization score (skill fit + workload + priority).
 */
export const ScoredUserSelect = ({
  value,
  onChange,
  role,
  auditType,
  priority,
  placeholder = 'Select user…',
  required,
  error,
  id,
  excludeIds = [],
}: ScoredUserSelectProps): JSX.Element => {
  const { data, isLoading } = useQuery({
    queryKey: ['engagements', 'eligible-users', role, auditType ?? '', priority ?? ''],
    queryFn: () => engagementsApi.eligibleUsers({ role, auditType, priority }),
    staleTime: 60_000,
  });

  const options = (data ?? []).filter((u) => !excludeIds.includes(u.id));

  return (
    <Select
      id={id}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      error={error}
      disabled={isLoading}
    >
      <option value="">{isLoading ? 'Loading eligible users…' : placeholder}</option>
      {options.map((u) => {
        const workload = `${u.activeEngagementCount} active`;
        const markers = [
          u.recommended ? '★ recommended' : null,
          u.overCapacity ? 'at capacity' : null,
        ].filter(Boolean);
        const suffix = markers.length ? ` — ${markers.join(', ')}` : '';
        return (
          <option key={u.id} value={u.id}>
            {u.displayName}
            {u.department ? ` (${u.department})` : ''} · {workload}
            {suffix}
          </option>
        );
      })}
    </Select>
  );
};
