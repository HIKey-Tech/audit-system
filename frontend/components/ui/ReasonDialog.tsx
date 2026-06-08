'use client';

import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils/cn';

interface ReasonDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  title: string;
  description?: ReactNode;
  reasonLabel?: string;
  placeholder?: string;
  confirmLabel?: string;
  /** Minimum trimmed length required to enable confirm. */
  minLength?: number;
  tone?: 'default' | 'danger';
  isLoading?: boolean;
}

export const ReasonDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  reasonLabel = 'Reason',
  placeholder,
  confirmLabel = 'Confirm',
  minLength = 1,
  tone = 'default',
  isLoading = false,
}: ReasonDialogProps): JSX.Element | null => {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const inputId = `${baseId}-input`;
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset + focus when opened.
  useEffect(() => {
    if (!open) return;
    setReason('');
    const id = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  // Escape to close (unless mid-flight).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, isLoading, onClose]);

  if (!open) return null;

  const trimmed = reason.trim();
  const valid = trimmed.length >= minLength;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in motion-reduce:animate-none"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={() => !isLoading && onClose()}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-lg border border-border bg-white p-5 shadow-card-hover">
        <div className="flex items-start gap-3">
          {tone === 'danger' && (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-danger">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-text-primary">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-xs text-text-secondary">{description}</p>
            )}
            <div className="mt-3">
              <label htmlFor={inputId} className="sr-only">
                {reasonLabel}
              </label>
              <textarea
                id={inputId}
                ref={textareaRef}
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={placeholder}
                disabled={isLoading}
                className={cn(
                  'w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-muted',
                  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
                  'disabled:cursor-not-allowed disabled:bg-surface',
                )}
              />
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={() => {
              if (valid) void onConfirm(trimmed);
            }}
            isLoading={isLoading}
            disabled={!valid}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
