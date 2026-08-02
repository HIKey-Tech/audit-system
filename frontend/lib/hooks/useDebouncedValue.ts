'use client';

import { useEffect, useState } from 'react';

/**
 * Delays propagation of a fast-changing value (a search box) so downstream
 * consumers — query keys, URL writes — settle instead of firing per keystroke.
 * The first value is returned immediately so initial renders aren't delayed.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (value === debounced) return;
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, debounced, delayMs]);

  return debounced;
}
