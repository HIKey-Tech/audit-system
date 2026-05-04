import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: EmptyStateProps): JSX.Element => (
  <div
    className={cn(
      'flex flex-col items-center justify-center text-center',
      compact ? 'py-8' : 'py-14 px-6',
      className,
    )}
  >
    {icon && (
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-alt text-text-muted">
        {icon}
      </div>
    )}
    <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
    {description && (
      <p className="mt-1 max-w-md text-xs text-text-secondary">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
