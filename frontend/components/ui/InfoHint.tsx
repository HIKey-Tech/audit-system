'use client';

import { ReactNode } from 'react';
import { Info, HelpCircle } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { cn } from '@/lib/utils/cn';

interface InfoHintProps {
  content: ReactNode;
  /** Accessible name for the icon button. */
  label?: string;
  icon?: 'info' | 'help';
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export const InfoHint = ({
  content,
  label = 'More information',
  icon = 'info',
  side = 'top',
  className,
}: InfoHintProps): JSX.Element => {
  const Icon = icon === 'help' ? HelpCircle : Info;
  return (
    <Tooltip content={content} side={side}>
      <button
        type="button"
        aria-label={label}
        className={cn(
          'inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full text-text-muted transition-colors',
          'hover:text-text-secondary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1',
          className,
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </button>
    </Tooltip>
  );
};
