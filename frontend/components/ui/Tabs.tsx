'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TabItem {
  key: string;
  label: ReactNode;
  count?: number | null;
  countTone?: 'default' | 'danger';
}

interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export const Tabs = ({ tabs, active, onChange, className }: TabsProps): JSX.Element => (
  <div className={cn('border-b border-border overflow-x-auto scrollbar-none', className)}>
    <nav className="-mb-px flex gap-x-1 whitespace-nowrap min-w-max" role="tablist">
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className={cn(
              'relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors',
              'border-b-2 -mb-px',
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-strong',
            )}
          >
            {t.label}
            {typeof t.count === 'number' && t.count > 0 && (
              <span
                className={cn(
                  'inline-flex items-center justify-center rounded-full px-1.5 min-w-[18px] h-4 text-[10px] font-semibold',
                  t.countTone === 'danger'
                    ? 'bg-red-100 text-danger'
                    : isActive
                      ? 'bg-primary text-white'
                      : 'bg-slate-200 text-text-secondary',
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  </div>
);
