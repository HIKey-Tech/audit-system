import { Children, ReactElement, ReactNode, cloneElement, isValidElement, useId } from 'react';
import { cn } from '@/lib/utils/cn';
import { InfoHint } from './InfoHint';

interface FormFieldProps {
  label?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  /** Renders a subtle "Optional" affordance. Ignored if `required` is set. */
  optional?: boolean;
  /** Help shown via an (i) icon next to the label. */
  tooltip?: ReactNode;
  /** Always-visible helper UNDER the label (intent / why). */
  description?: ReactNode;
  /** Helper UNDER the field (format / example). Hidden when `error` is present. */
  hint?: ReactNode;
  error?: string;
  /** Live "X / max" counter; turns danger at or over max. */
  counter?: { value: string; max: number };
  children: ReactNode;
  className?: string;
}

export const FormField = ({
  label,
  htmlFor,
  required,
  optional,
  tooltip,
  description,
  hint,
  error,
  counter,
  children,
  className,
}: FormFieldProps): JSX.Element => {
  const autoId = useId();
  const descId = description ? `${autoId}-desc` : undefined;
  const msgId = error || hint ? `${autoId}-msg` : undefined;
  const describedBy = [descId, msgId].filter(Boolean).join(' ') || undefined;

  // Best-effort: wire aria-describedby onto a single element child.
  const child = (() => {
    if (!describedBy) return children;
    const arr = Children.toArray(children);
    if (arr.length === 1 && isValidElement(arr[0])) {
      const el = arr[0] as ReactElement<{ 'aria-describedby'?: string }>;
      const existing = el.props['aria-describedby'];
      return cloneElement(el, {
        'aria-describedby': existing ? `${existing} ${describedBy}` : describedBy,
      });
    }
    return children;
  })();

  const overLimit = counter ? counter.value.length >= counter.max : false;

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={htmlFor} className="flex items-center gap-1 text-sm font-medium text-text-primary">
            <span>
              {label}
              {required && <span className="ml-0.5 text-danger">*</span>}
            </span>
            {tooltip && <InfoHint content={tooltip} />}
          </label>
          {optional && !required && (
            <span className="text-xs text-text-muted">Optional</span>
          )}
        </div>
      )}

      {description && (
        <p id={descId} className="text-xs text-text-secondary">
          {description}
        </p>
      )}

      {child}

      {(error || hint || counter) && (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {error ? (
              <p id={msgId} role="alert" className="text-xs text-danger">
                {error}
              </p>
            ) : hint ? (
              <p id={msgId} className="text-xs text-text-muted">
                {hint}
              </p>
            ) : null}
          </div>
          {counter && (
            <span
              className={cn(
                'shrink-0 text-xs tabular-nums',
                overLimit ? 'font-semibold text-danger' : 'text-text-muted',
              )}
            >
              {counter.value.length} / {counter.max}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
