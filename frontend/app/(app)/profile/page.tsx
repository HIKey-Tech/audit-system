'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Phone,
  RotateCcw,
  Save,
  ShieldCheck,
  Tags,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';

import { authApi } from '@/lib/api/auth';
import { usersApi, type UpdateUserDto } from '@/lib/api/users';
import type { UserDto } from '@/lib/types/domain';
import { cn } from '@/lib/utils/cn';
import { formatDate, formatDateTime, initialsFromName } from '@/lib/utils/format';
import { useSession } from '@/components/providers/AuthProvider';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';

const ProfileSchema = z.object({
  displayName: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  skillsText: z.string().max(4000).optional(),
});

const PasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
        'Password must contain uppercase, lowercase, number and special character',
      ),
    confirmPassword: z.string().min(1, 'Confirm the new password'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ProfileForm = z.infer<typeof ProfileSchema>;
type PasswordForm = z.infer<typeof PasswordSchema>;

const toSkillsText = (skills: string[] | undefined): string => (skills ?? []).join(', ');

const parseSkills = (value: string | undefined): string[] =>
  Array.from(
    new Set(
      (value ?? '')
        .split(/[,\n]/)
        .map((skill) => skill.trim())
        .filter(Boolean),
    ),
  ).slice(0, 30);

const syncSessionProfile = async (user: UserDto): Promise<void> => {
  await fetch('/api/auth/session-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      department: user.department,
      jobTitle: user.jobTitle,
    }),
  }).catch(() => undefined);
};

export default function ProfilePage(): JSX.Element {
  const router = useRouter();
  const session = useSession();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const { data: user, isLoading } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => usersApi.me(),
    staleTime: 30_000,
  });

  const effectiveUser = user ?? {
    id: session.id,
    email: session.email,
    firstName: session.firstName,
    lastName: session.lastName,
    displayName: session.displayName,
    avatarUrl: session.avatarUrl,
    phone: null,
    department: session.department,
    jobTitle: session.jobTitle,
    skills: [],
    emailVerified: false,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    roles: session.roles.map((name) => ({ id: name, name, description: null, permissions: [] })),
    permissions: session.permissions,
  };

  const displayName =
    effectiveUser.displayName ||
    `${effectiveUser.firstName} ${effectiveUser.lastName}`.trim() ||
    effectiveUser.email;
  const initials = initialsFromName(
    effectiveUser.firstName,
    effectiveUser.lastName,
    effectiveUser.displayName,
  );
  const primaryRole = effectiveUser.roles[0]?.name ?? 'viewer';

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: { displayName: '', phone: '', skillsText: '' },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(PasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!user) return;
    profileForm.reset({
      displayName: user.displayName ?? '',
      phone: user.phone ?? '',
      skillsText: toSkillsText(user.skills),
    });
  }, [profileForm, user]);

  const profileMutation = useMutation({
    mutationFn: async (values: ProfileForm) => {
      const dto: UpdateUserDto = {
        displayName: values.displayName?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        skills: parseSkills(values.skillsText),
      };
      return usersApi.updateMe(dto);
    },
    onSuccess: async (updated) => {
      await syncSessionProfile(updated);
      qc.setQueryData(['users', 'me'], updated);
      toast.success('Profile updated');
      router.refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not update profile'),
  });

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordForm) =>
      usersApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      passwordForm.reset();
      toast.success('Password changed');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not change password'),
  });

  const backupMutation = useMutation({
    mutationFn: () => authApi.regenerateBackupCodes(),
    onSuccess: (codes) => {
      setBackupCodes(codes);
      toast.success('Backup codes regenerated');
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Could not regenerate backup codes'),
  });

  const logoutAllMutation = useMutation({
    mutationFn: () => authApi.logoutAll(),
    onSuccess: () => {
      router.push('/login');
      router.refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not sign out'),
  });

  const roleNames = useMemo(
    () => effectiveUser.roles.map((role) => role.name.replace(/_/g, ' ')),
    [effectiveUser.roles],
  );

  return (
    <>
      <PageHeader
        title="Profile"
        subtitle="Your account, security, and access details."
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Profile' }]}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card>
            <div className="flex items-start gap-4">
              <Avatar initials={initials} size="lg" tone="green" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold text-text-primary">{displayName}</h2>
                <p className="mt-0.5 truncate text-sm text-text-secondary">{effectiveUser.email}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone={effectiveUser.isActive ? 'green' : 'red'} withDot>
                    {effectiveUser.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge tone="blue">{primaryRole.replace(/_/g, ' ')}</Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Account Snapshot" subtitle="Directory information" />
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : (
              <dl className="space-y-3">
                <Detail icon={<Building2 className="h-4 w-4" />} label="Department" value={effectiveUser.department} />
                <Detail icon={<UserRound className="h-4 w-4" />} label="Job title" value={effectiveUser.jobTitle} />
                <Detail icon={<Clock className="h-4 w-4" />} label="Last login" value={formatDateTime(effectiveUser.lastLoginAt)} />
                <Detail icon={<CalendarDays className="h-4 w-4" />} label="Created" value={formatDate(effectiveUser.createdAt)} />
              </dl>
            )}
          </Card>
        </aside>

        <section className="min-w-0">
          <Card padded={false} className="overflow-hidden">
            <Tabs
              active={activeTab}
              onChange={setActiveTab}
              tabs={[
                { key: 'profile', label: 'Profile' },
                { key: 'security', label: 'Security' },
                { key: 'access', label: 'Access' },
              ]}
            />

            <div className="p-5">
              {activeTab === 'profile' && (
                <form
                  className="space-y-5"
                  onSubmit={profileForm.handleSubmit((values) => profileMutation.mutate(values))}
                  noValidate
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="First name">
                      <Input value={effectiveUser.firstName} disabled leftIcon={<UserRound className="h-4 w-4" />} />
                    </FormField>
                    <FormField label="Last name">
                      <Input value={effectiveUser.lastName} disabled leftIcon={<UserRound className="h-4 w-4" />} />
                    </FormField>
                    <FormField label="Email address">
                      <Input value={effectiveUser.email} disabled leftIcon={<Mail className="h-4 w-4" />} />
                    </FormField>
                    <FormField
                      label="Display name"
                      htmlFor="displayName"
                      error={profileForm.formState.errors.displayName?.message}
                    >
                      <Input
                        id="displayName"
                        leftIcon={<UserRound className="h-4 w-4" />}
                        error={profileForm.formState.errors.displayName?.message}
                        {...profileForm.register('displayName')}
                      />
                    </FormField>
                    <FormField
                      label="Phone"
                      htmlFor="phone"
                      error={profileForm.formState.errors.phone?.message}
                    >
                      <Input
                        id="phone"
                        leftIcon={<Phone className="h-4 w-4" />}
                        error={profileForm.formState.errors.phone?.message}
                        {...profileForm.register('phone')}
                      />
                    </FormField>
                    <FormField label="Department">
                      <Input value={effectiveUser.department ?? ''} disabled leftIcon={<Building2 className="h-4 w-4" />} />
                    </FormField>
                    <FormField label="Job title">
                      <Input value={effectiveUser.jobTitle ?? ''} disabled leftIcon={<UserRound className="h-4 w-4" />} />
                    </FormField>
                    <FormField
                      label="Skills"
                      htmlFor="skillsText"
                      error={profileForm.formState.errors.skillsText?.message}
                      className="md:col-span-2"
                    >
                      <Input
                        id="skillsText"
                        placeholder="Risk assessment, ISO 27001, systems audit"
                        leftIcon={<Tags className="h-4 w-4" />}
                        error={profileForm.formState.errors.skillsText?.message}
                        {...profileForm.register('skillsText')}
                      />
                    </FormField>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      leftIcon={<Save className="h-4 w-4" />}
                      isLoading={profileMutation.isPending}
                    >
                      Save profile
                    </Button>
                  </div>
                </form>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6">
                  <form
                    className="space-y-4"
                    onSubmit={passwordForm.handleSubmit((values) => passwordMutation.mutate(values))}
                    noValidate
                  >
                    <CardHeader
                      title="Change Password"
                      subtitle="For local password accounts."
                      className="mb-0"
                    />
                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField
                        label="Current password"
                        htmlFor="currentPassword"
                        required
                        error={passwordForm.formState.errors.currentPassword?.message}
                      >
                        <Input
                          id="currentPassword"
                          type="password"
                          autoComplete="current-password"
                          leftIcon={<Lock className="h-4 w-4" />}
                          error={passwordForm.formState.errors.currentPassword?.message}
                          {...passwordForm.register('currentPassword')}
                        />
                      </FormField>
                      <FormField
                        label="New password"
                        htmlFor="newPassword"
                        required
                        error={passwordForm.formState.errors.newPassword?.message}
                      >
                        <Input
                          id="newPassword"
                          type="password"
                          autoComplete="new-password"
                          leftIcon={<KeyRound className="h-4 w-4" />}
                          error={passwordForm.formState.errors.newPassword?.message}
                          {...passwordForm.register('newPassword')}
                        />
                      </FormField>
                      <FormField
                        label="Confirm password"
                        htmlFor="confirmPassword"
                        required
                        error={passwordForm.formState.errors.confirmPassword?.message}
                      >
                        <Input
                          id="confirmPassword"
                          type="password"
                          autoComplete="new-password"
                          leftIcon={<KeyRound className="h-4 w-4" />}
                          error={passwordForm.formState.errors.confirmPassword?.message}
                          {...passwordForm.register('confirmPassword')}
                        />
                      </FormField>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        leftIcon={<Save className="h-4 w-4" />}
                        isLoading={passwordMutation.isPending}
                      >
                        Change password
                      </Button>
                    </div>
                  </form>

                  <div className="border-t border-border pt-5">
                    <CardHeader
                      title="Two-Factor Authentication"
                      subtitle="Authenticator app, email OTP, and recovery codes."
                      className="mb-3"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        leftIcon={<ShieldCheck className="h-4 w-4" />}
                        onClick={() => router.push('/login/2fa/enroll?optional=1&next=/profile')}
                      >
                        Set up 2FA
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        leftIcon={<RotateCcw className="h-4 w-4" />}
                        isLoading={backupMutation.isPending}
                        onClick={() => backupMutation.mutate()}
                      >
                        Regenerate backup codes
                      </Button>
                    </div>

                    {backupCodes.length > 0 && (
                      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-amber-900">New backup codes</p>
                            <p className="mt-0.5 text-xs text-amber-800">
                              Store these now. They are shown once.
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            leftIcon={<Copy className="h-3.5 w-3.5" />}
                            onClick={() => {
                              navigator.clipboard?.writeText(backupCodes.join('\n'));
                              toast.success('Backup codes copied');
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {backupCodes.map((code) => (
                            <code
                              key={code}
                              className="rounded border border-amber-200 bg-white px-2 py-1.5 text-center font-mono text-xs text-text-primary"
                            >
                              {code}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border pt-5">
                    <CardHeader
                      title="Sessions"
                      subtitle="End every active browser session for this account."
                      className="mb-3"
                    />
                    <Button
                      type="button"
                      variant="danger"
                      leftIcon={<LogOut className="h-4 w-4" />}
                      isLoading={logoutAllMutation.isPending}
                      onClick={() => logoutAllMutation.mutate()}
                    >
                      Log out everywhere
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'access' && (
                <div className="space-y-6">
                  <div>
                    <CardHeader title="Assigned Roles" subtitle={`${roleNames.length} role(s)`} />
                    <div className="flex flex-wrap gap-2">
                      {roleNames.length > 0 ? (
                        roleNames.map((role) => (
                          <Badge key={role} tone="blue">
                            {role}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-text-secondary">No roles assigned.</p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border pt-5">
                    <CardHeader
                      title="Effective Permissions"
                      subtitle={`${effectiveUser.permissions.length} permission(s)`}
                    />
                    {effectiveUser.permissions.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {effectiveUser.permissions.map((permission) => (
                          <span
                            key={permission}
                            className={cn(
                              'inline-flex min-h-8 items-center rounded-md border border-border bg-surface-alt px-2.5 py-1',
                              'font-mono text-xs text-text-secondary',
                            )}
                          >
                            {permission}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary">No permissions assigned.</p>
                    )}
                  </div>

                  <div className="border-t border-border pt-5">
                    <CardHeader title="Account State" />
                    <div className="grid gap-3 md:grid-cols-3">
                      <StateTile
                        icon={<CheckCircle2 className="h-4 w-4" />}
                        label="Status"
                        value={effectiveUser.isActive ? 'Active' : 'Inactive'}
                        tone={effectiveUser.isActive ? 'green' : 'red'}
                      />
                      <StateTile
                        icon={<Mail className="h-4 w-4" />}
                        label="Email"
                        value={effectiveUser.emailVerified ? 'Verified' : 'Not verified'}
                        tone={effectiveUser.emailVerified ? 'green' : 'amber'}
                      />
                      <StateTile
                        icon={<Clock className="h-4 w-4" />}
                        label="Last updated"
                        value={formatDateTime(effectiveUser.updatedAt)}
                        tone="gray"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>
      </div>
    </>
  );
}

const Detail = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | null | undefined;
}): JSX.Element => (
  <div className="flex items-start gap-3">
    <span className="mt-0.5 text-text-muted">{icon}</span>
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-text-primary">{value || '-'}</dd>
    </div>
  </div>
);

const StateTile = ({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: 'green' | 'red' | 'amber' | 'gray';
}): JSX.Element => {
  const toneClass = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    gray: 'border-border bg-surface-alt text-text-primary',
  }[tone];

  return (
    <div className={cn('rounded-md border px-3 py-3', toneClass)}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-75">{label}</p>
      </div>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
};
