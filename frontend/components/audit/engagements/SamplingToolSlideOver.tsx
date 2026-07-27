'use client';

import { SlideOver } from '@/components/ui/SlideOver';
import { SamplingPanel } from './SamplingPanel';

/**
 * Working-Papers-tab entry point for the sampling tool. Thin wrapper around
 * {@link SamplingPanel}; the standalone `/audit/sampling` page renders the same
 * panel. Mounting the panel only while open resets its state on each reopen.
 */
export const SamplingToolSlideOver = ({
  engagementId,
  open,
  onClose,
  onCreateWorkingPaper,
}: {
  engagementId: string;
  open: boolean;
  onClose: () => void;
  /** Opens the working-paper form prefilled with the methodology markdown. */
  onCreateWorkingPaper: (title: string, content: string) => void;
}): JSX.Element => {
  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Sampling tool"
      description="Draw a defensible, reproducible sample from a population file. Population and sample are stored as engagement evidence."
      width="xl"
    >
      {open && (
        <SamplingPanel
          engagementId={engagementId}
          onClose={onClose}
          onCreateWorkingPaper={onCreateWorkingPaper}
        />
      )}
    </SlideOver>
  );
};
