'use client';

import { useState, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Loader2,
  ShieldCheck,
  Smartphone,
  Mail,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';

type Method = 'totp' | 'email';
type Step = 'choose' | 'configure' | 'backup';

interface SetupData {
  method: Method;
  secret?: string;
  otpauthUrl?: string;
  qrDataUrl?: string;
}

const Enroll2faInner = (): JSX.Element => {
  const router = useRouter();
  const params = useSearchParams();
  const next = params?.get('next') ?? '/dashboard';
  const optional = params?.get('optional') === '1';

  const [step, setStep] = useState<Step>('choose');
  const [method, setMethod] = useState<Method>('totp');
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSetup = async (chosen: Method): Promise<void> => {
    setError(null);
    setBusy(true);
    setMethod(chosen);
    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ method: chosen }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        data?: SetupData;
      };
      if (!res.ok || !json.success || !json.data) {
        setError(json.message || 'Could not start setup');
        return;
      }
      setSetupData(json.data);
      setStep('configure');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server');
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!code.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/2fa/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ method, code: code.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        data?: { backupCodes: string[] };
      };
      if (!res.ok || !json.success || !json.data) {
        setError(json.message || 'Invalid code');
        return;
      }
      setBackupCodes(json.data.backupCodes);
      setStep('backup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server');
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = async (): Promise<void> => {
    await navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const finish = (): void => {
    router.push(next.startsWith('/') ? next : '/dashboard');
    router.refresh();
  };

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
              <h1 className="text-lg font-semibold text-text-primary">Set up two-factor authentication</h1>
              <p className="mt-1 text-xs text-text-secondary">
                {optional
                  ? 'Your organisation will soon require 2FA. Set it up now, or do it later from your account.'
                  : 'Your organisation requires 2FA. This adds a second step when you sign in.'}
              </p>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'choose' && (
            <div className="space-y-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => startSetup('totp')}
                className="flex w-full items-start gap-3 rounded-md border border-border p-4 text-left transition hover:border-primary disabled:opacity-60"
              >
                <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-medium text-text-primary">Authenticator app</span>
                  <span className="block text-xs text-text-secondary">
                    Use Google Authenticator, Microsoft Authenticator, or Authy. Recommended.
                  </span>
                </span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => startSetup('email')}
                className="flex w-full items-start gap-3 rounded-md border border-border p-4 text-left transition hover:border-primary disabled:opacity-60"
              >
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-medium text-text-primary">Email codes</span>
                  <span className="block text-xs text-text-secondary">
                    We email a one-time code each time you sign in.
                  </span>
                </span>
              </button>
              {busy && (
                <div className="flex items-center justify-center pt-2 text-text-secondary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}

              {optional && (
                <button
                  type="button"
                  onClick={finish}
                  className="block w-full pt-1 text-center text-xs font-medium text-text-secondary hover:text-primary"
                >
                  Skip for now
                </button>
              )}
            </div>
          )}

          {step === 'configure' && (
            <form onSubmit={submitCode} className="space-y-4" noValidate>
              {method === 'totp' && setupData?.qrDataUrl && (
                <div className="space-y-3">
                  <p className="text-xs text-text-secondary">
                    Scan this QR code with your authenticator app, then enter the 6-digit code it shows.
                  </p>
                  <div className="flex justify-center">
                    <Image
                      src={setupData.qrDataUrl}
                      alt="2FA QR code"
                      width={180}
                      height={180}
                      unoptimized
                      className="rounded-md border border-border"
                    />
                  </div>
                  {setupData.secret && (
                    <p className="text-center text-[11px] text-text-muted">
                      Can&apos;t scan? Enter this key:{' '}
                      <span className="font-mono break-all text-text-secondary">{setupData.secret}</span>
                    </p>
                  )}
                </div>
              )}

              {method === 'email' && (
                <p className="text-xs text-text-secondary">
                  We&apos;ve emailed you a 6-digit code. Enter it below to finish setup.
                </p>
              )}

              <FormField label="Verification code" htmlFor="code" required>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </FormField>

              <Button type="submit" fullWidth isLoading={busy} size="lg">
                {busy ? 'Verifying…' : 'Enable 2FA'}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStep('choose');
                  setCode('');
                  setError(null);
                }}
                className="block w-full text-center text-xs font-medium text-text-secondary hover:text-primary"
              >
                Choose a different method
              </button>
            </form>
          )}

          {step === 'backup' && (
            <div className="space-y-4">
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                Save these backup codes somewhere safe. Each can be used once if you lose access to
                your {method === 'email' ? 'email' : 'authenticator'}. They won&apos;t be shown again.
              </div>
              <ul className="grid grid-cols-2 gap-2 rounded-md border border-border bg-surface p-4 font-mono text-sm text-text-primary">
                {backupCodes.map((c) => (
                  <li key={c} className="text-center">{c}</li>
                ))}
              </ul>
              <Button type="button" variant="secondary" fullWidth onClick={copyCodes}>
                {copied ? (
                  <>
                    <Check className="mr-1.5 h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-4 w-4" /> Copy codes
                  </>
                )}
              </Button>
              <Button type="button" fullWidth size="lg" onClick={finish}>
                I&apos;ve saved my codes — continue
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function Enroll2faPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <Enroll2faInner />
    </Suspense>
  );
}
