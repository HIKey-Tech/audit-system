'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface ComboboxOption {
  value: string;
  label: string;
  hint?: string;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  emptyText?: string;
}

const baseField =
  'w-full rounded-md border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-muted ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

export const Combobox = ({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
  error,
  emptyText = 'No matches',
}: ComboboxProps): JSX.Element => {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [filter, options]);

  useEffect(() => {
    if (open) {
      setFilter('');
      setActiveIndex(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const choose = (opt: ComboboxOption) => {
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) choose(opt);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={Boolean(error) || undefined}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          baseField,
          'relative flex h-10 items-center justify-between gap-3 pr-10 text-left shadow-sm hover:border-primary/50',
          open && 'border-primary ring-2 ring-primary/20',
          disabled && 'cursor-not-allowed text-text-muted',
          error ? 'border-danger' : 'border-border',
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-text-muted')}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-border bg-white shadow-[0_18px_45px_rgba(15,23,42,0.18)] ring-1 ring-black/5 animate-fade-in motion-reduce:animate-none">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
            <input
              ref={inputRef}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search…"
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              role="combobox"
              aria-controls={listId}
              aria-expanded={open}
            />
          </div>
          <ul id={listId} role="listbox" className="scrollbar-thin max-h-64 overflow-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-text-muted">{emptyText}</li>
            ) : (
              filtered.map((opt, index) => {
                const isSelected = opt.value === value;
                const isActive = index === activeIndex;
                return (
                  <li key={opt.value} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(opt)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                        isActive || isSelected ? 'bg-primary/10 text-primary' : 'text-text-primary hover:bg-surface-hover',
                        isSelected && 'font-semibold',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{opt.label}</span>
                        {opt.hint && <span className="block truncate text-xs text-text-muted">{opt.hint}</span>}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
