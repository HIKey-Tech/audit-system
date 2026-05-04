'use client';

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  width?: 'md' | 'lg' | 'xl';
  children: ReactNode;
  footer?: ReactNode;
}

const WIDTHS = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export const SlideOver = ({
  open,
  onClose,
  title,
  description,
  width = 'lg',
  children,
  footer,
}: SlideOverProps): JSX.Element | null => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-labelledby="slideover-title"
    >
      <div
        className="absolute inset-0 z-0 bg-slate-900/30 animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 ml-auto flex h-full w-full pointer-events-none">
        <aside
          className={cn(
            'ml-auto flex h-full w-full flex-col bg-white shadow-2xl animate-slide-in-right pointer-events-auto',
            WIDTHS[width],
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2
                id="slideover-title"
                className="text-base font-semibold text-text-primary"
              >
                {title}
              </h2>
              {description && (
                <p className="mt-0.5 text-xs text-text-secondary">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-text-secondary hover:bg-surface-alt hover:text-text-primary"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">{children}</div>
          {footer && (
            <footer className="border-t border-border px-5 py-3 bg-surface-alt">
              {footer}
            </footer>
          )}
        </aside>
      </div>
    </div>
  );
};
