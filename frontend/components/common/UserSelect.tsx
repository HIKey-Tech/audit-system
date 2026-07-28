'use client';

import { useQuery } from '@tanstack/react-query';
import { Select } from '@/components/ui/Input';
import { usersApi } from '@/lib/api/users';

interface UserSelectProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  id?: string;
  excludeIds?: string[];
}

export const UserSelect = ({
  value,
  onChange,
  placeholder = 'Select user…',
  required,
  error,
  id,
  excludeIds = [],
}: UserSelectProps): JSX.Element => {
  const { data, isLoading } = useQuery({
    queryKey: ['users', 'directory'],
    queryFn: () => usersApi.directory(),
    staleTime: 5 * 60_000,
  });

  return (
    <Select
      id={id}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      error={error}
      disabled={isLoading}
    >
      <option value="">{isLoading ? 'Loading users…' : placeholder}</option>
      {data
        ?.filter((u) => u.isActive && !excludeIds.includes(u.id))
        .map((u) => (
          <option key={u.id} value={u.id}>
            {u.displayName || `${u.firstName} ${u.lastName}`}
            {u.department ? ` — ${u.department}` : ''}
          </option>
        ))}
    </Select>
  );
};
