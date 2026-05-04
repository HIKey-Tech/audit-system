import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export const FormField = ({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
}: FormFieldProps): JSX.Element => (
  <div className={cn('space-y-1.5', className)}>
    {label && (
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium text-text-primary"
      >
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
    )}
    {children}
    {error ? (
      <p className="text-xs text-danger">{error}</p>
    ) : hint ? (
      <p className="text-xs text-text-muted">{hint}</p>
    ) : null}
  </div>
);
