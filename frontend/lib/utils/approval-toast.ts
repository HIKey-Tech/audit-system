'use client';

// "Submitted" confirmation that also says who the item went to.
//
// Behaves exactly like the toast it replaces — the same message appears at once,
// in the same place. A moment later, if the approval chain can be read, that same
// toast is updated in place with a line saying who has it now and who is next.
// If the lookup fails, is slow, or the user may not read approvals, nothing
// changes and the original message simply stays. It can never block or fail a submit.
import { toast } from 'sonner';
import { workflowApi } from '@/lib/api/workflow';
import { describeApprovalRoute } from '@/lib/utils/approval-route';

const LOOKUP_TIMEOUT_MS = 4000;
const DETAIL_DURATION_MS = 9000;

export const toastSubmitted = (
  title: string,
  entityType: string,
  entityId: string | null | undefined,
): void => {
  const toastId = toast.success(title);
  if (!entityId) return;

  try {
    const lookup = workflowApi.getApprovalChain(entityType, entityId);
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), LOOKUP_TIMEOUT_MS));
    void Promise.race([lookup, timeout])
      .then((chain) => {
        const description = describeApprovalRoute(chain);
        if (description) toast.success(title, { id: toastId, description, duration: DETAIL_DURATION_MS });
      })
      .catch(() => undefined);
  } catch {
    /* keep the plain confirmation */
  }
};
