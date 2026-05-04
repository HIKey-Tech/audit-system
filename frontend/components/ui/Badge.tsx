import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { statusTone, humanizeStatus } from '@/lib/utils/status';

interface BadgeProps {
  status?: string | null;
  tone?: 'gray' | 'blue' | 'amber' | 'purple' | 'green' | 'red' | 'orange' | 'yellow';
  children?: ReactNode;
  size?: 'xs' | 'sm';
  className?: string;
  withDot?: boolean;
}

const RAW_TONES = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  purple: 'bg-violet-50 text-violet-700 ring-violet-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  yellow: 'bg-yellow-50 text-yellow-800 ring-yellow-200',
};

export const Badge = ({
  status,
  tone,
  children,
  size = 'xs',
  withDot = false,
  className,
}: BadgeProps): JSX.Element => {
  const t = status ? statusTone(status) : null;

  const classes = tone
    ? RAW_TONES[tone]
    : t
      ? `${t.bg} ${t.text} ring-1 ${t.ring}`
      : RAW_TONES.gray;

  const dotColor = tone
    ? RAW_TONES[tone].split(' ')[0].replace('bg-', 'bg-').replace('-50', '-500')
    : t?.dot;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 whitespace-nowrap',
        size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        classes,
        className,
      )}
    >
      {withDot && (
        <span className={cn('h-1.5 w-1.5 rounded-full', dotColor || 'bg-slate-500')} />
      )}
      {children ?? humanizeStatus(status)}
    </span>
  );
};

export const StatusBadge = ({
  status,
  size,
  withDot,
  className,
}: {
  status: string | null | undefined;
  size?: 'xs' | 'sm';
  withDot?: boolean;
  className?: string;
}): JSX.Element => (
  <Badge status={status ?? undefined} size={size} withDot={withDot} className={className} />
);
