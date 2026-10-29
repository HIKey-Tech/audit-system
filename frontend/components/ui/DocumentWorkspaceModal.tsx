'use client';

import React, { useEffect, useState, ReactNode } from 'react';
import { Maximize2, Minimize2, X, ArrowLeft, FileText } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { useScrollLock } from '@/lib/hooks/useScrollLock';

export interface DocumentWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  dirty?: boolean;
  headerCenter?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * An expansive, distraction-free document editing workspace modal.
 * Replaces narrow side-drawers (SlideOver) with a wide, Microsoft Word / Google Docs-style
 * canvas where formatting toolbars, wide tables, and A4 pages fit comfortably.
 */
export const DocumentWorkspaceModal: React.FC<DocumentWorkspaceModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  badge,
  dirty = false,
  headerCenter,
  headerRight,
  children,
  footer,
}) => {
  const [isMaximized, setIsMaximized] = useState(true);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  useScrollLock(open);

  useEffect(() => {
    if (!open) {
      setShowDiscardConfirm(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const isSelectOrInput =
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'SELECT' ||
          document.activeElement?.tagName === 'TEXTAREA';
        if (isSelectOrInput) return;

        e.stopPropagation();
        handleRequestClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dirty]);

  const handleRequestClose = () => {
    if (dirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={handleRequestClose}
        aria-hidden="true"
      />

      {/* Main Workspace Frame */}
      <div
        className={`fixed z-50 flex flex-col bg-white shadow-2xl transition-all duration-200 ${
          isMaximized
            ? 'inset-0 rounded-none'
            : 'inset-2 sm:inset-4 md:inset-6 rounded-xl border border-slate-300'
        }`}
        role="dialog"
        aria-modal="true"
      >
        {/* Workspace Top Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6 shrink-0">
          {/* Left: Back / Title / Subtitle */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={handleRequestClose}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title="Close editor and return to engagement"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exit Editor</span>
            </button>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#1E3A8A]">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {title || 'Document Editor'}
                  </div>
                  {badge && <div className="shrink-0">{badge}</div>}
                </div>
                {subtitle && (
                  <div className="text-[11px] text-slate-500 truncate">
                    {subtitle}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center: Context / Utilities */}
          {headerCenter && (
            <div className="flex items-center gap-2 order-3 w-full lg:w-auto lg:order-2">
              {headerCenter}
            </div>
          )}

          {/* Right: Actions / Window Controls */}
          <div className="flex items-center gap-2 order-2 lg:order-3 ml-auto">
            {headerRight}

            <div className="h-5 w-px bg-slate-200" />

            <button
              type="button"
              onClick={() => setIsMaximized((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title={isMaximized ? 'Restore floating window' : 'Maximize to fullscreen'}
            >
              {isMaximized ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={handleRequestClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-100">
          {children}
        </div>

        {/* Optional Footer Bar */}
        {footer && (
          <div className="border-t border-slate-200 bg-white px-4 py-2.5 sm:px-6 shrink-0">
            {footer}
          </div>
        )}
      </div>

      {/* Discard Changes Prompt */}
      <ConfirmDialog
        open={showDiscardConfirm}
        title="Discard unsaved changes?"
        description="You have unsaved changes in this document. Closing will discard your edits."
        confirmLabel="Discard & Exit"
        cancelLabel="Keep Editing"
        variant="danger"
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onClose();
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </>
  );
};

