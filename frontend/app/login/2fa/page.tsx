'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';

const Verify2faInner = (): JSX.Element => {
  const router = useRouter();
  const params = useSearchParams();
  const method = (params?.get('method') ?? 'totp') as 'totp' | 'email';
  const next = params?.get('next') ?? '/dashboard';

  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!code.trim()) return;
    setServerError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: code.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };
      if (!res.ok || !json.success) {
        setServerError(json.message || 'Verification failed');
        return;
      }
      router.push(next.startsWith('/') ? next : '/dashboard');
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not reach the server');
    } finally {
      setSubmitting(false);
    }
  };

  const prompt = useBackup
    ? 'Enter one of your backup recovery codes.'
    : method === 'email'
      ? 'Enter the 6-digit code we just emailed you.'
      : 'Enter the 6-digit code from your authenticator app.';

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface flex items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/5" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-accent/5" aria-hidden />

      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex flex-col items-center">
            <span className="text-3xl font-bold tracking-tight text-primary">GBB</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">IAMS</span>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-8 shadow-card">
          <div className="mb-6 flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h1 className="text-lg font-semibold text-text-primary">Two-factor verification</h1>
              <p className="mt-1 text-xs text-text-secondary">{prompt}</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField
              label={useBackup ? 'Backup code' : 'Verification code'}
              htmlFor="code"
              required
            >
              <Input
                id="code"
                inputMode={useBackup ? 'text' : 'numeric'}
                autoComplete="one-time-code"
                autoFocus
                placeholder={useBackup ? 'xxxxx-xxxxx' : '123456'}
                value={code}
                onChange={(e) => setCode(e.target.value)}
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

            <Button type="submit" fullWidth isLoading={submitting} size="lg">
              {submitting ? 'Verifying…' : 'Verify'}
            </Button>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setUseBackup((s) => !s);
                  setCode('');
                  setServerError(null);
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                {useBackup ? 'Use your authenticator instead' : 'Use a backup code'}
              </button>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-primary"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default function Verify2faPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <Verify2faInner />
    </Suspense>
  );
}
