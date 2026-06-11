'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Lock, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';

const ResetSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
        'Must include uppercase, lowercase, number and special character',
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetInput = z.infer<typeof ResetSchema>;

const ResetInner = (): JSX.Element => {
  const router = useRouter();
  const params = useSearchParams();
  const token = params?.get('token') ?? '';
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetInput>({
    resolver: zodResolver(ResetSchema),
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: values.newPassword }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };
      if (!res.ok || !json.success) {
        setServerError(json.message || 'Could not reset password');
        return;
      }
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Could not reach the server',
      );
    }
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface flex items-center justify-center px-4 py-12">
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/5"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-accent/5"
        aria-hidden
      />

      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex flex-col items-center">
            <span className="text-3xl font-bold tracking-tight text-primary">GBB</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">
              IAMS
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-8 shadow-card">
          {done ? (
            <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-700">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Password reset. Redirecting you to sign in…</span>
            </div>
          ) : !token ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>This reset link is invalid or incomplete. Please request a new one.</span>
              </div>
              <Link
                href="/forgot-password"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Request a new link
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-lg font-semibold text-text-primary">Set a new password</h1>
                <p className="mt-1 text-xs text-text-secondary">
                  Choose a strong password you haven&apos;t used before.
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <FormField
                  label="New password"
                  htmlFor="newPassword"
                  required
                  error={errors.newPassword?.message}
                >
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      leftIcon={<Lock className="h-4 w-4" />}
                      error={errors.newPassword?.message}
                      className="pr-10"
                      {...register('newPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormField>

                <FormField
                  label="Confirm password"
                  htmlFor="confirmPassword"
                  required
                  error={errors.confirmPassword?.message}
                >
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    leftIcon={<Lock className="h-4 w-4" />}
                    error={errors.confirmPassword?.message}
                    {...register('confirmPassword')}
                  />
                </FormField>

                {serverError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger"
                  >
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{serverError}</span>
                  </div>
                )}

                <Button type="submit" fullWidth isLoading={isSubmitting} size="lg">
                  {isSubmitting ? 'Resetting…' : 'Reset password'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default function ResetPasswordPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <ResetInner />
    </Suspense>
  );
}
