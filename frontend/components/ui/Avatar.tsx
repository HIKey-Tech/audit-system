import { cn } from '@/lib/utils/cn';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  initials: string;
  size?: AvatarSize;
  className?: string;
  tone?: 'navy' | 'green' | 'slate';
}

const SIZES: Record<AvatarSize, string> = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
};

const TONES = {
  navy: 'bg-primary text-white',
  green: 'bg-accent text-white',
  slate: 'bg-slate-200 text-slate-700',
};

export const Avatar = ({
  initials,
  size = 'md',
  className,
  tone = 'navy',
}: AvatarProps): JSX.Element => (
  <div
    className={cn(
      'inline-flex items-center justify-center rounded-full font-semibold uppercase tracking-tight',
      SIZES[size],
      TONES[tone],
      className,
    )}
    aria-hidden
  >
    {initials.slice(0, 2)}
  </div>
);
