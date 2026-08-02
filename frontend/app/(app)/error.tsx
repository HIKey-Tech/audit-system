'use client';

import { useEffect } from 'react';
import Link from 'next/link';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  useEffect(() => {
    // Surfaced in the browser console for support; the audit trail lives server-side.
    console.error('IAMS page error:', error);
  }, [error]);

  return (
    <Card>
      <ErrorState
        title="This page could not be displayed"
        message={
          error.digest
            ? `An unexpected error occurred. Quote reference ${error.digest} when reporting it.`
            : 'An unexpected error occurred. Retry, or return to your dashboard.'
        }
        onRetry={reset}
      />
      <div className="flex justify-center pb-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            Back to Home
          </Button>
        </Link>
      </div>
    </Card>
  );
}
