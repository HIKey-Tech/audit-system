import { ExceptionSeverity } from '../domain/enum/system-audit.enum';

export const SEVERITY_RANK: Record<ExceptionSeverity, number> = {
  [ExceptionSeverity.Critical]: 4,
  [ExceptionSeverity.High]: 3,
  [ExceptionSeverity.Medium]: 2,
  [ExceptionSeverity.Low]: 1,
};

export const maxSeverity = (a: ExceptionSeverity, b: ExceptionSeverity): ExceptionSeverity =>
  SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;

/** Lower-case alphanumerics only — how headers and names are compared. */
export const normaliseKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Case-insensitive wildcard match (`*` = any run of characters). Used for SoD
 * rules and privileged-entitlement patterns, which GBB edits as plain text.
 */
export const matchesPattern = (value: string, pattern: string): boolean => {
  const escaped = pattern
    .trim()
    .toLowerCase()
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(value.trim().toLowerCase());
};

export const matchesAny = (value: string, patterns: string[]): boolean =>
  patterns.some((p) => matchesPattern(value, p));

export const hoursBetween = (from: Date, to: Date): number => (to.getTime() - from.getTime()) / 3_600_000;

export const daysBetween = (from: Date, to: Date): number => hoursBetween(from, to) / 24;

export const round = (value: number, places = 1): number => {
  const f = 10 ** places;
  return Math.round(value * f) / f;
};

export const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

/**
 * Next yearly reference for a prefix, e.g. SAR-2026-0007. Callers retry once on
 * a unique-constraint clash (two runs created in the same instant).
 */
export const nextReference = (prefix: string, latest: string | null | undefined, now = new Date()): string => {
  const year = now.getFullYear();
  const match = latest?.match(new RegExp(`^${prefix}-${year}-(\\d+)$`));
  const next = match ? Number(match[1]) + 1 : 1;
  return `${prefix}-${year}-${String(next).padStart(4, '0')}`;
};

export interface UserRef {
  id: string;
  name: string;
}

export const toUserRef = (
  user: { id: string; display_name: string | null; first_name: string; last_name: string; email: string } | null | undefined,
): UserRef | null =>
  user
    ? { id: user.id, name: user.display_name?.trim() || `${user.first_name} ${user.last_name}`.trim() || user.email }
    : null;
