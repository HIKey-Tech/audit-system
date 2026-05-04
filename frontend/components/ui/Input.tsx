'use client';

import {
  ChangeEvent,
  Children,
  FocusEvent,
  ForwardedRef,
  InputHTMLAttributes,
  KeyboardEvent,
  MutableRefObject,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const baseField =
  'w-full rounded-md border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-muted ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:bg-surface ' +
  'disabled:cursor-not-allowed transition-colors';

interface BaseProps {
  error?: string;
  leftIcon?: ReactNode;
}

type InputProps = BaseProps & InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, leftIcon, className, ...rest }, ref) => (
    <div className="relative">
      {leftIcon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
          {leftIcon}
        </span>
      )}
      <input
        ref={ref}
        className={cn(
          baseField,
          'h-10',
          leftIcon && 'pl-9',
          error
            ? 'border-danger focus:border-danger focus:ring-danger/20'
            : 'border-border',
          className,
        )}
        aria-invalid={Boolean(error) || undefined}
        {...rest}
      />
    </div>
  ),
);
Input.displayName = 'Input';

type SelectProps = BaseProps & SelectHTMLAttributes<HTMLSelectElement>;

type SelectOption = {
  value: string;
  label: ReactNode;
  disabled: boolean;
};

const optionText = (node: ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(optionText).join('');
  }

  return '';
};

const collectSelectOptions = (children: ReactNode): SelectOption[] => {
  const options: SelectOption[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    if (child.type === 'option') {
      const option = child as ReactElement<{
        value?: string | number;
        disabled?: boolean;
        children?: ReactNode;
      }>;

      options.push({
        value: String(option.props.value ?? optionText(option.props.children)),
        label: option.props.children,
        disabled: Boolean(option.props.disabled),
      });
      return;
    }

    if ('children' in child.props) {
      options.push(...collectSelectOptions(child.props.children));
    }
  });

  return options;
};

const splitSelectClassName = (className?: string): { wrapperClassName?: string; controlClassName?: string } => {
  if (!className) {
    return {};
  }

  const wrapperTokens = new Set([
    'block',
    'inline-block',
    'inline-flex',
    'flex',
    'grid',
    'grow',
    'shrink',
  ]);
  const wrapperPrefixes = [
    'w-',
    'min-w-',
    'max-w-',
    'm-',
    'mt-',
    'mr-',
    'mb-',
    'ml-',
    'mx-',
    'my-',
    'basis-',
    'self-',
    'col-',
    'col-span-',
  ];
  const wrapper: string[] = [];
  const control: string[] = [];

  className.split(/\s+/).filter(Boolean).forEach((token) => {
    const unprefixed = token.replace(/^(sm|md|lg|xl|2xl):/, '');
    const isWrapperClass =
      wrapperTokens.has(unprefixed) ||
      wrapperPrefixes.some((prefix) => token.startsWith(prefix) || unprefixed.startsWith(prefix));

    if (isWrapperClass) {
      wrapper.push(token);
      return;
    }

    control.push(token);
  });

  return {
    wrapperClassName: wrapper.join(' ') || undefined,
    controlClassName: control.join(' ') || undefined,
  };
};

const setForwardedRef = <T,>(ref: ForwardedRef<T>, value: T | null): void => {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }

  if (ref) {
    (ref as MutableRefObject<T | null>).current = value;
  }
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      error,
      className,
      children,
      value,
      defaultValue,
      onChange,
      onBlur,
      disabled,
      id,
      name,
      required,
      ...rest
    },
    ref,
  ) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const rootRef = useRef<HTMLDivElement>(null);
    const selectRef = useRef<HTMLSelectElement | null>(null);
    const options = useMemo(() => collectSelectOptions(children), [children]);
    const firstValue = options[0]?.value ?? '';
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [internalValue, setInternalValue] = useState(() => String(defaultValue ?? firstValue));
    const selectedValue = value !== undefined ? String(value) : internalValue;
    const selectedIndex = options.findIndex((option) => option.value === selectedValue);
    const selectedOption = options[selectedIndex] ?? options[0];
    const { wrapperClassName, controlClassName } = splitSelectClassName(className);

    useEffect(() => {
      if (value === undefined && defaultValue !== undefined) {
        setInternalValue(String(defaultValue));
      }
    }, [defaultValue, value]);

    useEffect(() => {
      if (value === undefined && options.length > 0 && !options.some((option) => option.value === internalValue)) {
        setInternalValue(firstValue);
      }
    }, [firstValue, internalValue, options, value]);

    useEffect(() => {
      if (open) {
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      }
    }, [open, selectedIndex]);

    useEffect(() => {
      if (!open) {
        return undefined;
      }

      const handlePointerDown = (event: MouseEvent): void => {
        if (!rootRef.current?.contains(event.target as Node)) {
          setOpen(false);
          emitBlur();
        }
      };

      document.addEventListener('mousedown', handlePointerDown);
      return () => document.removeEventListener('mousedown', handlePointerDown);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const emitBlur = (): void => {
      if (!onBlur) {
        return;
      }

      onBlur({
        target: selectRef.current ?? { name, value: selectedValue },
        currentTarget: selectRef.current ?? { name, value: selectedValue },
      } as unknown as FocusEvent<HTMLSelectElement>);
    };

    const emitChange = (nextValue: string): void => {
      if (selectRef.current) {
        selectRef.current.value = nextValue;
      }

      if (value === undefined) {
        setInternalValue(nextValue);
      }

      onChange?.({
        target: selectRef.current ?? { name, value: nextValue },
        currentTarget: selectRef.current ?? { name, value: nextValue },
      } as unknown as ChangeEvent<HTMLSelectElement>);
    };

    const chooseOption = (option: SelectOption): void => {
      if (option.disabled || disabled) {
        return;
      }

      emitChange(option.value);
      setOpen(false);
      emitBlur();
    };

    const handleNativeChange = (event: ChangeEvent<HTMLSelectElement>): void => {
      if (value === undefined) {
        setInternalValue(event.target.value);
      }

      onChange?.(event);
    };

    const moveActive = (delta: number): void => {
      if (options.length === 0) {
        return;
      }

      let nextIndex = activeIndex;

      for (let i = 0; i < options.length; i += 1) {
        nextIndex = (nextIndex + delta + options.length) % options.length;
        if (!options[nextIndex]?.disabled) {
          setActiveIndex(nextIndex);
          return;
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
      if (disabled) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        moveActive(1);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        moveActive(-1);
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (open && options[activeIndex]) {
          chooseOption(options[activeIndex]);
          return;
        }
        setOpen(true);
        return;
      }

      if (event.key === 'Escape') {
        setOpen(false);
        emitBlur();
      }
    };

    return (
      <div ref={rootRef} className={cn('relative w-full', wrapperClassName)}>
        <select
          ref={(node) => {
            selectRef.current = node;
            setForwardedRef(ref, node);
          }}
          id={selectId}
          name={name}
          required={required}
          disabled={disabled}
          value={selectedValue}
          onChange={handleNativeChange}
          onBlur={onBlur}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          {...rest}
        >
          {children}
        </select>

        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${selectId}-listbox`}
          aria-invalid={Boolean(error) || undefined}
          aria-required={required || undefined}
          onClick={() => {
            if (!disabled) {
              setOpen((current) => !current);
            }
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            baseField,
            'relative flex h-10 items-center justify-between gap-3 pr-10 text-left shadow-sm',
            'hover:border-primary/50 hover:bg-surface-alt',
            open && 'border-primary ring-2 ring-primary/20',
            disabled && 'text-text-muted',
            error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border',
            controlClassName,
          )}
        >
          <span className={cn('min-w-0 flex-1 truncate', selectedOption?.value === '' && 'text-text-muted')}>
            {selectedOption?.label ?? selectedValue}
          </span>
          <span className="pointer-events-none absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-text-secondary">
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-150', open && 'rotate-180')} />
          </span>
        </button>

        {open && (
          <div
            id={`${selectId}-listbox`}
            role="listbox"
            aria-activedescendant={`${selectId}-option-${activeIndex}`}
            className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-border bg-white p-1 shadow-[0_18px_45px_rgba(15,23,42,0.18)] ring-1 ring-black/5 animate-fade-in"
          >
            <div className="scrollbar-thin max-h-64 overflow-auto">
              {options.map((option, index) => {
                const selected = option.value === selectedValue;
                const active = index === activeIndex;

                return (
                  <button
                    key={`${option.value}-${index}`}
                    id={`${selectId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={option.disabled}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => chooseOption(option)}
                    className={cn(
                      'group flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                      active || selected
                        ? 'bg-primary/10 text-primary'
                        : 'text-text-primary hover:bg-surface-hover',
                      selected && 'font-semibold',
                      option.disabled && 'cursor-not-allowed text-text-muted opacity-60',
                    )}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                        selected ? 'bg-primary text-white' : 'text-transparent group-hover:text-primary/50',
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  },
);
Select.displayName = 'Select';

type TextareaProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className, rows = 4, ...rest }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        baseField,
        'resize-y',
        error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border',
        className,
      )}
      aria-invalid={Boolean(error) || undefined}
      {...rest}
    />
  ),
);
Textarea.displayName = 'Textarea';
