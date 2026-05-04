'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-600 active:bg-primary-700 disabled:bg-primary-200 disabled:text-white/80',
  secondary:
    'bg-white text-text-primary border border-border hover:bg-surface-alt active:bg-slate-100 disabled:text-text-muted disabled:bg-surface',
  danger:
    'bg-danger text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-200',
  success:
    'bg-success text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-200',
  ghost:
    'bg-transparent text-text-primary hover:bg-surface-alt active:bg-slate-100 disabled:text-text-muted',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-sm gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      leftIcon,
      rightIcon,
      fullWidth,
      className,
      type = 'button',
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || isLoading;
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors',
          'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed select-none',
          VARIANTS[variant],
          SIZES[size],
          fullWidth && 'w-full',
          className,
        )}
        {...rest}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          leftIcon
        )}
        {!isLoading && children}
        {isLoading && children ? <span className="opacity-70">{children}</span> : null}
        {!isLoading && rightIcon}
      </button>
    );
  },
);
Button.displayName = 'Button';
