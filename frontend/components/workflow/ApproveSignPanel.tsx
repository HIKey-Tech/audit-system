'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { SignaturePad } from '@/components/common/SignaturePad';
import { workflowApi } from '@/lib/api/workflow';
import { signatureApi } from '@/lib/api/signature';

// Reports and working papers must carry a visible signature; plans / finding
// closures may be approved without one.
const SIGNATURE_REQUIRED = new Set(['audit_report', 'audit_working_paper']);

/**
 * Inline "Approve & Sign" panel: previews the user's signature (or lets them set
 * one up inline), then approves. The backend records the active signature on the
 * approval step automatically — approving is signing.
 *
 * By default it approves via the workflow approval endpoint (`approvalId`). Entity
 * surfaces whose approve goes through their own API (audit plans, working papers —
 * which funnel into the same approval service server-side) pass `approveFn` instead.
 */
export function ApproveSignPanel({
  approvalId,
  entityType,
  approveFn,
  showComment = true,
  onDone,
}: {
  approvalId?: string;
  entityType: string;
  approveFn?: () => Promise<unknown>;
  showComment?: boolean;
  onDone: () => void;
}): JSX.Element {
  const qc = useQueryClient();
  const [comment, setComment] = useState('');

  const { data: sig, isLoading } = useQuery({
    queryKey: ['signature'],
    queryFn: () => signatureApi.get(),
  });

  const saveSig = useMutation({
    mutationFn: ({ blob, kind }: { blob: Blob; kind: 'drawn' | 'uploaded' }) =>
      signatureApi.save(blob, kind),
    onSuccess: () => {
      toast.success('Signature saved');
      qc.invalidateQueries({ queryKey: ['signature'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to save signature'),
  });

  const approve = useMutation({
    mutationFn: () =>
      approveFn ? approveFn() : workflowApi.approve(approvalId!, comment.trim() || undefined),
    onSuccess: () => {
      toast.success('Approved & signed');
      qc.invalidateQueries({ queryKey: ['workflow'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to approve'),
  });

  const mustSign = SIGNATURE_REQUIRED.has(entityType);
  const canConfirm = !mustSign || !!sig;

  return (
    <div className="mt-3 space-y-3 rounded-md border border-border bg-surface-alt p-3">
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : sig ? (
        <div className="rounded-md border border-border bg-white px-3 py-2">
          <p className="mb-1 text-xs font-medium text-text-secondary">Approving &amp; signing as</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sig.imageUrl} alt="Your signature" className="h-14 object-contain" />
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-white px-3 py-3">
          <p className="mb-2 text-xs text-text-secondary">
            {mustSign
              ? 'A signature is required to approve this. Draw or upload one — it’s saved to your profile and stamped onto the signed document.'
              : 'You have no signature yet. Add one to stamp it, or approve without a signature.'}
          </p>
          <SignaturePad onChange={(blob, kind) => saveSig.mutate({ blob, kind })} />
        </div>
      )}

      {showComment && (
        <FormField label="Comment (optional)">
          <Textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a note with your approval…"
          />
        </FormField>
      )}

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="success"
          disabled={!canConfirm}
          isLoading={approve.isPending}
          onClick={() => approve.mutate()}
        >
          Approve &amp; Sign
        </Button>
      </div>
    </div>
  );
}
