'use client';

import { useEffect } from 'react';

/**
 * Locks background scrolling while an overlay is open. Reference-counted so
 * nested overlays (a ConfirmDialog inside a SlideOver) don't unlock the page
 * when the inner one closes.
 */
let lockCount = 0;

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lockCount += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      lockCount -= 1;
      if (lockCount <= 0) {
        lockCount = 0;
        document.body.style.overflow = '';
      }
    };
  }, [active]);
}
