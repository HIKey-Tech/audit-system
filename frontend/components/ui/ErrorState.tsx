'use client';

import { AlertCircle, RotateCw } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils/cn';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export const ErrorState = ({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
  compact,
}: ErrorStateProps): JSX.Element => (
  <div
    className={cn(
      'flex flex-col items-center justify-center text-center',
      compact ? 'py-8' : 'py-14 px-6',
      className,
    )}
  >
    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-danger">
      <AlertCircle className="h-5 w-5" aria-hidden />
    </div>
    <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
    {message && (
      <p className="mt-1 max-w-md text-xs text-text-secondary">{message}</p>
    )}
    {onRetry && (
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<RotateCw className="h-3.5 w-3.5" />}
        onClick={onRetry}
        className="mt-4"
      >
        Try again
      </Button>
    )}
  </div>
);
