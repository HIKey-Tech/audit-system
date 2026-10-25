'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface CopyButtonProps {
  value: string;
  className?: string;
  label?: string;
  showText?: boolean;
}

export function CopyButton({
  value,
  className,
  label,
  showText = false,
}: CopyButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Fallback for browsers that block clipboard API
      const input = document.createElement('textarea');
      input.value = value;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied to clipboard!' : `Copy ${label || value}`}
      className={cn(
        'group relative inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-text-muted transition-all hover:bg-surface-alt hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
        copied && 'text-emerald-600 font-medium',
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-600 animate-in zoom-in-50 duration-150" />
          {showText && <span className="text-[11px] text-emerald-600">Copied</span>}
        </>
      ) : (
        <>
          <Copy className="h-3 w-3 text-text-muted group-hover:text-text-primary transition-colors" />
          {showText && <span className="text-[11px]">{label || 'Copy'}</span>}
        </>
      )}

      {/* Floating micro-tooltip on copy */}
      {copied && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-md pointer-events-none whitespace-nowrap animate-in fade-in-0 zoom-in-95 duration-100">
          Copied!
        </span>
      )}
    </button>
  );
}
