'use client';

import { useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Keeps list-screen state (tab, filters, page, sort) in the URL query string so
 * Back, refresh, and a pasted link all restore the same view. Values equal to
 * their default are omitted, keeping URLs short.
 *
 * Values are always strings — the caller converts (e.g. `Number(values.page)`).
 */
export function useQueryFilters<T extends Record<string, string>>(
  defaults: T,
): { values: T; set: (patch: Partial<T>) => void; reset: () => void } {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? '';

  // Defaults are typically an inline literal, so a new object each render. Hold
  // them in a ref so `set` stays referentially stable across renders.
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const current = new URLSearchParams(search);
  const values = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const raw = current.get(key);
    if (raw !== null) (values as Record<string, string>)[key] = raw;
  }

  const push = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : (pathname ?? ''), { scroll: false });
    },
    [router, pathname],
  );

  // Each call builds on the query string as of this render, so two `set` calls
  // within one render pass would clobber each other. Call it from event handlers
  // (and at most one effect), not from several effects in the same flush.
  const set = useCallback(
    (patch: Partial<T>) => {
      const next = new URLSearchParams(search);
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === '' || value === defaultsRef.current[key]) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      push(next);
    },
    [search, push],
  );

  const reset = useCallback(() => {
    const next = new URLSearchParams(search);
    for (const key of Object.keys(defaultsRef.current)) next.delete(key);
    push(next);
  }, [search, push]);

  return { values, set, reset };
}
