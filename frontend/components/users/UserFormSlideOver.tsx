'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ChevronDown, X } from 'lucide-react';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select } from '@/components/ui/Input';
import { usersApi } from '@/lib/api/users';
import { cn } from '@/lib/utils/cn';
import type { UserDto } from '@/lib/types/domain';

const Schema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Valid email required'),
  jobTitle: z.string().max(200).optional().or(z.literal('')),
  department: z.string().max(200).optional().or(z.literal('')),
  isActive: z.enum(['true', 'false']),
});

type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  user?: UserDto | null;
}

export const UserFormSlideOver = ({ open, onClose, user }: Props): JSX.Element => {
  const qc = useQueryClient();
  const isEdit = Boolean(user);

  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [roleDropOpen, setRoleDropOpen] = useState(false);
  const roleDropRef = useRef<HTMLDivElement>(null);

  const rolesQuery = useQuery({
    queryKey: ['users', 'roles'],
    queryFn: () => usersApi.getRoles(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      jobTitle: '',
      department: '',
      isActive: 'true',
    },
  });

  useEffect(() => {
    if (open && user) {
      reset({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        jobTitle: user.jobTitle ?? '',
        department: user.department ?? '',
        isActive: user.isActive ? 'true' : 'false',
      });
      setSelectedRoleIds(user.roles.map((r) => r.id));
    } else if (open && !user) {
      reset({
        firstName: '',
        lastName: '',
        email: '',
        jobTitle: '',
        department: '',
        isActive: 'true',
      });
      setSelectedRoleIds([]);
    }
  }, [open, user, reset]);

  useEffect(() => {
    if (!roleDropOpen) return;
    const handler = (e: MouseEvent) => {
      if (roleDropRef.current && !roleDropRef.current.contains(e.target as Node)) {
        setRoleDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [roleDropOpen]);

  const createMut = useMutation({
    mutationFn: async (values: FormValues) => {
      const created = await usersApi.create({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        jobTitle: values.jobTitle || undefined,
        department: values.department || undefined,
      });
      if (selectedRoleIds.length > 0) {
        await usersApi.assignRoles(created.id, selectedRoleIds);
      }
      return created;
    },
    onSuccess: () => {
      toast.success('User created');
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create user'),
  });

  const updateMut = useMutation({
    mutationFn: async (values: FormValues) => {
      const updated = await usersApi.update(user!.id, {
        firstName: values.firstName,
        lastName: values.lastName,
        jobTitle: values.jobTitle || undefined,
        department: values.department || undefined,
        isActive: values.isActive === 'true',
      });
      await usersApi.assignRoles(user!.id, selectedRoleIds);
      return updated;
    },
    onSuccess: () => {
      toast.success('User updated');
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['users', user!.id] });
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update user'),
  });

  const onSubmit = handleSubmit((values) => {
    if (isEdit) updateMut.mutate(values);
    else createMut.mutate(values);
  });

  const toggleRole = (id: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const allRoles = rolesQuery.data ?? [];
  const selectedRoles = allRoles.filter((r) => selectedRoleIds.includes(r.id));

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit user' : 'New user'}
      description="Manage user accounts and role assignments for the GBB IAMS platform."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} size="sm">
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            isLoading={isSubmitting || createMut.isPending || updateMut.isPending}
            size="sm"
          >
            {isEdit ? 'Save changes' : 'Create user'}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="First Name" required error={errors.firstName?.message}>
            <Input
              placeholder="Chidi"
              error={errors.firstName?.message}
              {...register('firstName')}
            />
          </FormField>
          <FormField label="Last Name" required error={errors.lastName?.message}>
            <Input
              placeholder="Nwosu"
              error={errors.lastName?.message}
              {...register('lastName')}
            />
          </FormField>
        </div>

        <FormField label="Email" required error={errors.email?.message}>
          <Input
            type="email"
            placeholder="chidi.nwosu@gbb.gov.ng"
            error={errors.email?.message}
            disabled={isEdit}
            {...register('email')}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Job Title" error={errors.jobTitle?.message}>
            <Input
              placeholder="Internal Auditor"
              error={errors.jobTitle?.message}
              {...register('jobTitle')}
            />
          </FormField>
          <FormField label="Department" error={errors.department?.message}>
            <Input
              placeholder="Audit & Compliance"
              error={errors.department?.message}
              {...register('department')}
            />
          </FormField>
        </div>

        {isEdit && (
          <FormField label="Status">
            <Select {...register('isActive')}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </FormField>
        )}

        <FormField label="Roles">
          <div ref={roleDropRef} className="relative">
            <button
              type="button"
              onClick={() => setRoleDropOpen((o) => !o)}
              className={cn(
                'w-full rounded-md border bg-white px-3 py-2 text-sm text-left',
                'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
                'border-border hover:border-primary/50 hover:bg-surface-alt transition-colors',
                'flex items-center justify-between gap-2 min-h-[40px]',
                roleDropOpen && 'border-primary ring-2 ring-primary/20',
              )}
            >
              <div className="flex flex-wrap gap-1 min-h-[24px] flex-1">
                {selectedRoles.length === 0 ? (
                  <span className="text-text-muted text-sm">Select roles…</span>
                ) : (
                  selectedRoles.map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary ring-1 ring-primary/20"
                    >
                      {r.name.replace(/_/g, ' ')}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRole(r.id);
                        }}
                        className="text-primary/60 hover:text-primary cursor-pointer"
                        aria-label={`Remove ${r.name}`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))
                )}
              </div>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 shrink-0 text-text-secondary transition-transform duration-150',
                  roleDropOpen && 'rotate-180',
                )}
              />
            </button>

            {roleDropOpen && (
              <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-border bg-white p-1 shadow-[0_18px_45px_rgba(15,23,42,0.18)] ring-1 ring-black/5 animate-fade-in">
                {rolesQuery.isLoading ? (
                  <div className="px-3 py-4 text-center text-xs text-text-muted">
                    Loading roles…
                  </div>
                ) : allRoles.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-text-muted">
                    No roles found.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-auto scrollbar-thin">
                    {allRoles.map((role) => {
                      const selected = selectedRoleIds.includes(role.id);
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => toggleRole(role.id)}
                          className={cn(
                            'group flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors cursor-pointer',
                            selected
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-text-primary hover:bg-surface-hover',
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate">{role.name.replace(/_/g, ' ')}</p>
                            {role.description && (
                              <p className="truncate text-[11px] text-text-secondary font-normal">
                                {role.description}
                              </p>
                            )}
                          </div>
                          <span
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                              selected
                                ? 'bg-primary text-white'
                                : 'text-transparent group-hover:text-primary/50',
                            )}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </FormField>
      </form>
    </SlideOver>
  );
};
