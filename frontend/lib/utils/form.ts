import type { FieldErrors } from 'react-hook-form';
import { toast } from 'sonner';

/** Recursively find the first `message` string in a react-hook-form errors tree. */
export function firstErrorMessage(errors: unknown): string | undefined {
  if (!errors || typeof errors !== 'object') return undefined;
  const node = errors as Record<string, unknown>;
  if (typeof node.message === 'string' && node.message) return node.message;
  for (const value of Object.values(node)) {
    const found = firstErrorMessage(value);
    if (found) return found;
  }
  return undefined;
}

/**
 * Standard react-hook-form invalid-submit handler: without one, a failing
 * validation makes the submit button silently do nothing. Surfaces the first
 * error as a toast so the user knows why nothing happened.
 */
export function toastOnInvalid(errors: FieldErrors): void {
  toast.error(firstErrorMessage(errors) ?? 'Please fix the highlighted fields');
}
