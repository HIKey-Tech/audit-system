'use client';

import { X } from 'lucide-react';

/** The people or areas already added to a group audit, each removable. */
export const ChipList = ({
  items,
  onRemove,
  emptyText,
}: {
  items: Array<{ id: string; label: string }>;
  onRemove: (id: string) => void;
  emptyText: string;
}): JSX.Element =>
  items.length === 0 ? (
    <p className="mt-2 text-xs text-text-muted">{emptyText}</p>
  ) : (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {items.map((i) => (
        <li
          key={i.id}
          className="inline-flex items-center gap-1 rounded-full bg-surface-alt py-1 pl-2.5 pr-1.5 text-xs text-text-primary ring-1 ring-border"
        >
          {i.label}
          <button
            type="button"
            aria-label={`Remove ${i.label}`}
            className="rounded-full p-0.5 text-text-muted hover:bg-white hover:text-danger"
            onClick={() => onRemove(i.id)}
          >
            <X className="h-3 w-3" />
          </button>
        </li>
      ))}
    </ul>
  );
