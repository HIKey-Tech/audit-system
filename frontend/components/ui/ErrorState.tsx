'use client';

import { AlertCircle, RotateCw } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils/cn';
import { ApiError, NetworkError } from '@/lib/api-client';

interface ErrorStateProps {
  title?: string;
  message?: string;
  /** The error thrown by the failed request; used to explain rate limits, permissions and connectivity. */
  error?: unknown;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

const describeError = (
  error: unknown,
): { title: string; message?: string } | null => {
  if (error instanceof NetworkError) {
    return {
      title: 'Cannot reach the server',
      message: 'Check your connection and try again.',
    };
  }
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return { title: 'Too many requests', message: error.message };
    }
    if (error.status === 403) {
      return {
        title: 'Access denied',
        message: 'Your role does not have permission to view this.',
      };
    }
    if (error.status === 404) {
      return {
        title: 'Not found',
        message: 'This item does not exist or you do not have access to it.',
      };
    }
    if (error.status >= 500) {
      return {
        title: 'The server had a problem',
        message: 'Try again in a moment. If it keeps happening, contact support.',
      };
    }
  }
  return null;
};

export const ErrorState = ({
  title: titleProp,
  message: messageProp,
  error,
  onRetry,
  className,
  compact,
}: ErrorStateProps): JSX.Element => {
  const described = describeError(error);
  const title = titleProp ?? described?.title ?? 'Something went wrong';
  const message = messageProp ?? described?.message;
  return (
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
};
