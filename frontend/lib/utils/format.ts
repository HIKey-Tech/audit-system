import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

const toDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : parseISO(value);
  return isValid(d) ? d : null;
};

export const formatDate = (
  value: string | Date | null | undefined,
  fallback = '—',
): string => {
  const d = toDate(value);
  return d ? format(d, 'd MMM yyyy') : fallback;
};

export const formatDateTime = (
  value: string | Date | null | undefined,
  fallback = '—',
): string => {
  const d = toDate(value);
  return d ? format(d, 'd MMM yyyy, HH:mm') : fallback;
};

export const formatRelative = (
  value: string | Date | null | undefined,
  fallback = '—',
): string => {
  const d = toDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : fallback;
};

export const formatNumber = (value: number | null | undefined, fallback = '—'): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return value.toLocaleString();
};

export const formatPercent = (value: number | null | undefined, fallback = '—'): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return `${value.toFixed(1)}%`;
};

export const formatFileSize = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
};

export const initialsFromName = (
  first?: string | null,
  last?: string | null,
  display?: string | null,
): string => {
  if (display && display.trim()) {
    const parts = display.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  const a = first?.[0] ?? '';
  const b = last?.[0] ?? '';
  const out = (a + b).toUpperCase();
  return out || '?';
};
