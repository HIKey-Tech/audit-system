'use client';

import { useQuery } from '@tanstack/react-query';
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox';
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

  // Searchable so a long staff directory is not a scroll-and-hope list. When the field is
  // optional the first entry clears the selection.
  const options: ComboboxOption[] = [
    ...(required ? [] : [{ value: '', label: placeholder }]),
    ...(data ?? [])
      .filter((u) => u.isActive && !excludeIds.includes(u.id))
      .map((u) => ({
        value: u.id,
        label: u.displayName || `${u.firstName} ${u.lastName}`,
        hint: u.department ?? undefined,
      })),
  ];

  return (
    <div id={id}>
      <Combobox
        value={value ?? ''}
        onChange={onChange}
        options={options}
        placeholder={isLoading ? 'Loading users…' : placeholder}
        disabled={isLoading}
        error={error}
        emptyText="No matching users"
      />
    </div>
  );
};
