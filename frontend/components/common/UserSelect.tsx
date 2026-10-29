'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';

import { Combobox, type ComboboxOption } from '@/components/ui/Combobox';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { usersApi } from '@/lib/api/users';

interface UserSelectProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  id?: string;
  excludeIds?: string[];
  /** Show the quick AD pre-provisioning drawer when a user hasn't logged in yet (default true). */
  allowProvision?: boolean;
}

export const UserSelect = ({
  value,
  onChange,
  placeholder = 'Select user…',
  required,
  error,
  id,
  excludeIds = [],
  allowProvision = true,
}: UserSelectProps): JSX.Element => {
  const qc = useQueryClient();
  const [showProvision, setShowProvision] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['users', 'directory'],
    queryFn: () => usersApi.directory(),
    staleTime: 5 * 60_000,
  });

  const handleEmailChange = (rawEmail: string): void => {
    setEmail(rawEmail);
    const local = rawEmail.split('@')[0] ?? '';
    const parts = local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
    if (parts.length >= 1 && !firstName) {
      setFirstName(parts[0]);
    }
    if (parts.length >= 2 && !lastName) {
      setLastName(parts.slice(1).join(' '));
    }
  };

  const provision = useMutation({
    mutationFn: () =>
      usersApi.provisionAuditee({
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        department: department.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
      }),
    onSuccess: async (created) => {
      // Immediately seed both directory and paginated user caches so parent forms
      // (e.g. StartAuditWizard Review/Launch steps) resolve the display name right away.
      qc.setQueryData<typeof data>(['users', 'directory'], (old) => {
        if (!old) return [created];
        return old.some((u) => u.id === created.id) ? old : [created, ...old];
      });
      qc.setQueryData<{ items: typeof data; meta?: Record<string, unknown> }>(['users', 'all'], (old) => {
        if (!old || !Array.isArray(old.items)) return old;
        return old.items.some((u) => u.id === created.id)
          ? old
          : { ...old, items: [created, ...old.items] };
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['users', 'directory'] }),
        qc.invalidateQueries({ queryKey: ['users', 'all'] }),
        qc.invalidateQueries({ queryKey: ['users'] }),
      ]);
      onChange(created.id);
      toast.success(
        `${created.displayName || `${created.firstName} ${created.lastName}`} provisioned with Auditee access & notifications enabled`,
      );
      setShowProvision(false);
      setEmail('');
      setFirstName('');
      setLastName('');
      setDepartment('');
      setJobTitle('');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to provision user'),
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
    <div id={id} className="space-y-1.5">
      <Combobox
        value={value ?? ''}
        onChange={onChange}
        options={options}
        placeholder={isLoading ? 'Loading users…' : placeholder}
        disabled={isLoading}
        error={error}
        emptyText="No matching users — click below to add from Active Directory / Email"
      />
      {allowProvision && !showProvision && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowProvision(true)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            <UserPlus className="h-3 w-3" />
            Staff hasn&apos;t logged in yet? Add by AD corporate email
          </button>
        </div>
      )}
      {allowProvision && showProvision && (
        <div className="rounded-md border border-primary/25 bg-primary/5 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-text-primary">
              Pre-Provision Staff from Active Directory / Email
            </p>
            <button
              type="button"
              onClick={() => setShowProvision(false)}
              className="text-text-muted hover:text-text-primary"
              aria-label="Close pre-provision form"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-text-secondary">
            Register a staff member who has not yet logged in via Active Directory. They will automatically be granted the <strong>Auditee</strong> role and receive email notifications immediately.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="sm:col-span-2">
              <Input
                type="email"
                placeholder="Corporate email (e.g. john.doe@galaxybackbone.com.ng)"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
              />
            </div>
            <Input
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <Input
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            <Input
              placeholder="Department (optional)"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
            <Input
              placeholder="Job title (optional)"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setShowProvision(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!email.trim().includes('@')}
              isLoading={provision.isPending}
              onClick={() => provision.mutate()}
            >
              Provision &amp; Select
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
