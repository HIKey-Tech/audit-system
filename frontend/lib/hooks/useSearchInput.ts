'use client';

import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * Two-way binding between a search box and its URL parameter.
 *
 * Typing stays local (so the field is never laggy) and is pushed to the URL once
 * it settles. Changes that arrive from the *outside* — Back/forward, a pasted
 * link — are adopted back into the box instead of being overwritten by whatever
 * was last typed, which is what naively pushing the debounced value does: it
 * re-applies the old term and makes Back look broken.
 *
 * `lastSynced` is the value the box and the URL last agreed on; a difference on
 * either side tells us which direction the change came from.
 */
export function useSearchInput(
  urlValue: string,
  commit: (next: string) => void,
  delayMs = 300,
): [string, (value: string) => void] {
  const [input, setInput] = useState(urlValue);
  const debounced = useDebouncedValue(input, delayMs);
  const lastSynced = useRef(urlValue);

  // URL moved on its own → adopt it.
  useEffect(() => {
    if (urlValue !== lastSynced.current) {
      lastSynced.current = urlValue;
      setInput(urlValue);
    }
  }, [urlValue]);

  // Typing settled → publish it. `debounced === input` is the "settled" test: it
  // also blocks the one render after an adoption, where `debounced` still holds
  // the previously typed term and would otherwise be pushed straight back.
  useEffect(() => {
    if (debounced === input && debounced !== lastSynced.current) {
      lastSynced.current = debounced;
      commit(debounced);
    }
  }, [debounced, input, commit]);

  return [input, setInput];
}
