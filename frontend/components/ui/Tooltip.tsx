'use client';

import { ReactElement, ReactNode } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils/cn';

interface TooltipProps {
  /** Help content. If empty/nullish, the trigger renders without a tooltip. */
  content: ReactNode;
  /** Single trigger element; must forward ref + props (DOM element or forwardRef component). */
  children: ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** Override per-tooltip open delay (ms). */
  delayMs?: number;
  className?: string;
}

export const Tooltip = ({
  content,
  children,
  side = 'top',
  align = 'center',
  delayMs,
  className,
}: TooltipProps): JSX.Element => {
  if (content === null || content === undefined || content === '') {
    return <>{children}</>;
  }

  return (
    <RadixTooltip.Root delayDuration={delayMs}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            'z-50 max-w-xs rounded-md bg-[#1A202C] px-2.5 py-1.5 text-xs font-medium leading-snug text-white shadow-card-hover',
            'animate-fade-in motion-reduce:animate-none',
            className,
          )}
        >
          {content}
          <RadixTooltip.Arrow className="fill-[#1A202C]" width={10} height={5} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
};
