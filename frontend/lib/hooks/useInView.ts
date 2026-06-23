'use client';

import { useEffect, useRef, useState } from 'react';

interface UseInViewOptions {
  /** Stop observing once seen — for one-shot lazy loads. Default: true. */
  once?: boolean;
  /** Margin around the root, e.g. '200px' to pre-load before fully visible. */
  rootMargin?: string;
}

/**
 * Tracks whether the returned ref is within the viewport. Used to defer
 * expensive below-the-fold work (e.g. the heavy analytics query) until the
 * element actually scrolls into view. Falls back to `true` when
 * IntersectionObserver is unavailable so content is never withheld.
 */
export const useInView = <T extends Element = HTMLDivElement>(
  { once = true, rootMargin = '200px' }: UseInViewOptions = {},
): { ref: React.RefObject<T>; inView: boolean } => {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once, rootMargin]);

  return { ref, inView };
};
