'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useScrollLock } from '@/lib/hooks/useScrollLock';
import { ConfirmDialog } from './ConfirmDialog';

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  width?: 'md' | 'lg' | 'xl';
  children: ReactNode;
  footer?: ReactNode;
  /**
   * Set while the panel holds unsaved edits. Backdrop click, Esc, and the close
   * button then ask for confirmation instead of silently discarding the work.
   */
  dirty?: boolean;
}

const WIDTHS = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

// `:not([tabindex="-1"])` matters on every clause: the Select primitive keeps a
// visually hidden native <select> that must stay out of the tab cycle.
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  '[tabindex]',
]
  .map((sel) => `${sel}:not([tabindex="-1"]):not([aria-hidden="true"])`)
  .join(', ');

export const SlideOver = ({
  open,
  onClose,
  title,
  description,
  width = 'lg',
  children,
  footer,
  dirty = false,
}: SlideOverProps): JSX.Element | null => {
  const panelRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const requestClose = useCallback(() => {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  // The focus-trap effect must run once per open/close, not whenever `dirty` or
  // `onClose` change — re-running it would yank focus out of the field being
  // typed into. Reach the latest closer through a ref instead.
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        requestCloseRef.current();
        return;
      }
      // Keep Tab inside the panel — otherwise focus walks the page behind it.
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    // Land on the first editable field rather than the header's close button;
    // read-only panels fall back to the first focusable element.
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      // `Select` keeps a visually hidden native <select> for form semantics —
      // exclude anything aria-hidden or taken out of the tab order.
      const target =
        panel.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]):not([aria-hidden="true"]):not([tabindex="-1"]),' +
            ' textarea:not([disabled]):not([aria-hidden="true"]):not([tabindex="-1"])',
        ) ?? panel.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    });

    return () => {
      document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

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
        onClick={requestClose}
        aria-hidden
      />
      <div className="relative z-10 ml-auto flex h-full w-full pointer-events-none">
        <aside
          ref={panelRef}
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
              onClick={requestClose}
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

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard unsaved changes?"
        description="This panel has edits that have not been saved. Closing it will lose them."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        variant="danger"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </div>
  );
};
