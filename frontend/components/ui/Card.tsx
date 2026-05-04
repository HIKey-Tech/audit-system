import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface CardProps {
  className?: string;
  children: ReactNode;
  padded?: boolean;
}

export const Card = ({ className, children, padded = true }: CardProps): JSX.Element => (
  <div
    className={cn(
      'rounded-lg border border-border bg-surface-elevated shadow-card',
      padded && 'p-5',
      className,
    )}
  >
    {children}
  </div>
);

export const CardHeader = ({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}): JSX.Element => (
  <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const CardFooter = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}): JSX.Element => (
  <div className={cn('mt-4 pt-4 border-t border-border', className)}>{children}</div>
);
