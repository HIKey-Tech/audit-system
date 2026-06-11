'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';

const ForgotSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type ForgotInput = z.infer<typeof ForgotSchema>;

export default function ForgotPasswordPage(): JSX.Element {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotInput>({
    resolver: zodResolver(ForgotSchema),
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };
      if (!res.ok || !json.success) {
        setServerError(json.message || 'Something went wrong');
        return;
      }
      setSubmitted(true);
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
          {submitted ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-700">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  We&apos;ve sent a password reset link. Check your inbox and spam folder.
                </span>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-lg font-semibold text-text-primary">Forgot your password?</h1>
                <p className="mt-1 text-xs text-text-secondary">
                  Enter your work email and we&apos;ll send you a link to reset it.
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
                  {isSubmitting ? 'Sending…' : 'Send reset link'}
                </Button>

                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to sign in
                </Link>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
