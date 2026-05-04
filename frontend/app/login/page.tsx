'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Mail, Lock, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';

const LoginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginInput = z.infer<typeof LoginSchema>;

const LoginInner = (): JSX.Element => {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/dashboard';
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };
      if (!res.ok || !json.success) {
        setServerError(json.message || 'Sign in failed');
        return;
      }
      router.push(next.startsWith('/') ? next : '/dashboard');
      router.refresh();
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Could not reach the server',
      );
    }
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface flex items-center justify-center px-4 py-12">
      {/* Subtle navy ribbon top-left */}
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
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-text-primary">Welcome back</h1>
            <p className="mt-1 text-xs text-text-secondary">
              Internal Audit Management System — sign in with your work email.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField
              label="Email address"
              htmlFor="email"
              required
              error={errors.email?.message}
            >
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@gbb.gov.ng"
                leftIcon={<Mail className="h-4 w-4" />}
                error={errors.email?.message}
                {...register('email')}
              />
            </FormField>

            <FormField
              label="Password"
              htmlFor="password"
              required
              error={errors.password?.message}
            >
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  leftIcon={<Lock className="h-4 w-4" />}
                  error={errors.password?.message}
                  className="pr-10"
                  {...register('password')}
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
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] uppercase tracking-widest text-text-muted">
          Powered by Plustive Heritage Engineering
        </p>
      </div>
    </div>
  );
};

export default function LoginPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
