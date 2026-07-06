'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
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

interface ReportEditFields {
  executiveSummary: string;
  scope: string;
  methodology: string;
}

interface WpSection {
  title: string;
  content: string;
}

/** Working-paper content is either `{sections:[{title,content}]}` JSON or free text. */
const parseWpSections = (raw: string): WpSection[] | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { sections?: unknown }).sections) &&
      ((parsed as { sections: unknown[] }).sections as unknown[]).every(
        (s) => !!s && typeof s === 'object' && typeof (s as WpSection).title === 'string' && typeof (s as WpSection).content === 'string',
      )
    ) {
      return (parsed as { sections: WpSection[] }).sections;
    }
  } catch {
    /* free-text paper */
  }
  return null;
};

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
  reportFields,
  wpContent,
}: {
  approvalId?: string;
  entityType: string;
  approveFn?: (edits?: { content: string }) => Promise<unknown>;
  showComment?: boolean;
  onDone: () => void;
  /** Current report body fields — enables "edit & approve" for audit_report
   * entities, so a small fix doesn't require rejecting and resubmitting the
   * whole approval chain from level 1. Only used when approving via `approvalId`
   * (not when a caller supplies its own `approveFn`). */
  reportFields?: ReportEditFields;
  /** Current working-paper content — enables "edit & approve" for
   * audit_working_paper entities via the caller's `approveFn(edits)`. */
  wpContent?: string;
}): JSX.Element {
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const canEditReport = entityType === 'audit_report' && !!reportFields && !approveFn;
  const canEditWp = entityType === 'audit_working_paper' && wpContent !== undefined && !!approveFn;
  const [isEditing, setIsEditing] = useState(false);
  const [edited, setEdited] = useState<ReportEditFields>(
    reportFields ?? { executiveSummary: '', scope: '', methodology: '' },
  );
  const wpSections = canEditWp ? parseWpSections(wpContent) : null;
  const [editedSections, setEditedSections] = useState<WpSection[]>(wpSections ?? []);
  const [editedFreeText, setEditedFreeText] = useState(wpSections ? '' : (wpContent ?? ''));

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
    mutationFn: () => {
      if (approveFn) {
        if (canEditWp && isEditing) {
          const newContent = wpSections
            ? JSON.stringify({ sections: editedSections })
            : editedFreeText;
          if (newContent !== wpContent) return approveFn({ content: newContent });
        }
        return approveFn();
      }
      const edits =
        isEditing && reportFields
          ? {
              ...(edited.executiveSummary !== reportFields.executiveSummary && { executiveSummary: edited.executiveSummary }),
              ...(edited.scope !== reportFields.scope && { scope: edited.scope }),
              ...(edited.methodology !== reportFields.methodology && { methodology: edited.methodology }),
            }
          : undefined;
      return workflowApi.approve(approvalId!, comment.trim() || undefined, edits);
    },
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

      {canEditWp && (
        <div>
          <button
            type="button"
            onClick={() => setIsEditing((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover"
          >
            <Pencil className="h-3.5 w-3.5" />
            {isEditing ? 'Cancel edit' : 'Found a small issue? Edit & approve instead of rejecting'}
          </button>
          {isEditing && (
            <div className="mt-2 space-y-2 rounded-md border border-border bg-white p-2.5">
              {wpSections ? (
                editedSections.map((section, index) => (
                  <FormField key={`${section.title}-${index}`} label={section.title}>
                    <Textarea
                      rows={4}
                      value={section.content}
                      onChange={(e) =>
                        setEditedSections((current) => {
                          const next = [...current];
                          next[index] = { ...next[index], content: e.target.value };
                          return next;
                        })
                      }
                    />
                  </FormField>
                ))
              ) : (
                <FormField label="Content">
                  <Textarea
                    rows={12}
                    value={editedFreeText}
                    onChange={(e) => setEditedFreeText(e.target.value)}
                    className="font-mono text-xs"
                  />
                </FormField>
              )}
            </div>
          )}
        </div>
      )}

      {canEditReport && (
        <div>
          <button
            type="button"
            onClick={() => setIsEditing((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover"
          >
            <Pencil className="h-3.5 w-3.5" />
            {isEditing ? 'Cancel edit' : 'Found a small issue? Edit & approve instead of rejecting'}
          </button>
          {isEditing && (
            <div className="mt-2 space-y-2 rounded-md border border-border bg-white p-2.5">
              <FormField label="Executive summary">
                <Textarea
                  rows={4}
                  value={edited.executiveSummary}
                  onChange={(e) => setEdited((v) => ({ ...v, executiveSummary: e.target.value }))}
                />
              </FormField>
              <FormField label="Scope">
                <Textarea
                  rows={3}
                  value={edited.scope}
                  onChange={(e) => setEdited((v) => ({ ...v, scope: e.target.value }))}
                />
              </FormField>
              <FormField label="Methodology">
                <Textarea
                  rows={3}
                  value={edited.methodology}
                  onChange={(e) => setEdited((v) => ({ ...v, methodology: e.target.value }))}
                />
              </FormField>
            </div>
          )}
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
