'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select, Textarea } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { evidenceApi, findingsApi, followUpApi } from '@/lib/api/audit';
import { useSession, hasAnyRole } from '@/components/providers/AuthProvider';
import type { AuditEngagementDetail, AuditEvidence, AuditFinding } from '@/lib/types/domain';

export const FollowUpTab = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const qc = useQueryClient();
  const session = useSession();
  const isAuditor = hasAnyRole(session, ['audit_lead', 'auditor', 'audit_admin', 'super_admin']);

  const findings = useQuery({
    queryKey: ['engagements', engagement.id, 'findings'],
    queryFn: () => findingsApi.listByEngagement(engagement.id),
  });
  const evidence = useQuery({
    queryKey: ['engagements', engagement.id, 'evidence'],
    queryFn: () => evidenceApi.listByEngagement(engagement.id),
  });

  const findingRows = findings.data ?? engagement.findings ?? [];

  if (findingRows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<CheckCircle2 className="h-4 w-4" />}
          title="No findings yet"
          description="Follow-up items appear here once findings are raised."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {findingRows.map((f) => (
        <FollowUpRow
          key={f.id}
          finding={f}
          evidence={evidence.data ?? []}
          isAuditee={f.auditeeId === session.id}
          isAuditor={isAuditor}
          onChange={() => {
            qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
            qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'findings'] });
          }}
        />
      ))}
    </div>
  );
};

const FollowUpRow = ({
  finding,
  evidence,
  isAuditee,
  isAuditor,
  onChange,
}: {
  finding: AuditFinding;
  evidence: AuditEvidence[];
  isAuditee: boolean;
  isAuditor: boolean;
  onChange: () => void;
}): JSX.Element => {
  const [responseOpen, setResponseOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [response, setResponse] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [verification, setVerification] = useState<'verified' | 'rejected'>('verified');
  const [notes, setNotes] = useState('');

  const submitResponse = useMutation({
    mutationFn: () => followUpApi.submitResponse(finding.id, { managementResponse: response }),
    onSuccess: () => {
      toast.success('Response submitted');
      onChange();
      setResponseOpen(false);
      setResponse('');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const submitEvidence = useMutation({
    mutationFn: () => followUpApi.submitEvidence(finding.id, evidenceId),
    onSuccess: () => {
      toast.success('Remediation evidence attached');
      onChange();
      setEvidenceOpen(false);
      setEvidenceId('');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const uploadEvidence = useMutation({
    mutationFn: () => followUpApi.uploadEvidence(finding.id, evidenceFile!),
    onSuccess: () => {
      toast.success('Remediation evidence uploaded');
      onChange();
      setEvidenceOpen(false);
      setEvidenceFile(null);
      setEvidenceId('');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const submitVerify = useMutation({
    mutationFn: () =>
      followUpApi.verify(finding.id, {
        verificationStatus: verification,
        verificationNotes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Verification recorded');
      onChange();
      setVerifyOpen(false);
      setNotes('');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-text-primary">{finding.title}</p>
            <StatusBadge status={finding.severity} size="xs" />
            <StatusBadge status={finding.status} size="xs" />
          </div>
          <p className="mt-1 text-xs text-text-secondary">Auditee: {finding.auditeeName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAuditee && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setResponseOpen((o) => !o)}>
                Submit response
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEvidenceOpen((o) => !o)}>
                Attach evidence
              </Button>
            </>
          )}
          {isAuditor && (
            <Button size="sm" onClick={() => setVerifyOpen((o) => !o)}>
              Verify
            </Button>
          )}
        </div>
      </div>

      {responseOpen && (
        <div className="mt-4 rounded-md border border-border bg-surface-alt p-3">
          <FormField label="Management response" required>
            <Textarea
              rows={4}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Describe planned remediation and timeline…"
            />
          </FormField>
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setResponseOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!response.trim()) {
                  toast.error('Response cannot be empty');
                  return;
                }
                submitResponse.mutate();
              }}
              isLoading={submitResponse.isPending}
            >
              Submit
            </Button>
          </div>
        </div>
      )}

      {evidenceOpen && (
        <div className="mt-4 rounded-md border border-border bg-surface-alt p-3">
          <FormField label="Remediation evidence" required>
            <Select value={evidenceId} onChange={(e) => setEvidenceId(e.target.value)}>
              <option value="">Select existing evidence...</option>
              {evidence.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.fileName}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Or upload a new file">
            <input
              type="file"
              onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-text-primary file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
            />
          </FormField>
          <div className="mt-2 flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEvidenceOpen(false);
                setEvidenceFile(null);
                setEvidenceId('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (evidenceFile) {
                  uploadEvidence.mutate();
                  return;
                }
                if (evidenceId) {
                  submitEvidence.mutate();
                  return;
                }
                toast.error('Select or upload remediation evidence');
              }}
              isLoading={submitEvidence.isPending || uploadEvidence.isPending}
            >
              Submit evidence
            </Button>
          </div>
        </div>
      )}

      {verifyOpen && (
        <div className="mt-4 rounded-md border border-border bg-surface-alt p-3">
          <FormField label="Verification">
            <div className="flex items-center gap-4 text-xs">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name={`v-${finding.id}`}
                  checked={verification === 'verified'}
                  onChange={() => setVerification('verified')}
                />
                Verified
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name={`v-${finding.id}`}
                  checked={verification === 'rejected'}
                  onChange={() => setVerification('rejected')}
                />
                Rejected
              </label>
            </div>
          </FormField>
          <FormField label="Notes">
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setVerifyOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => submitVerify.mutate()} isLoading={submitVerify.isPending}>
              Save verification
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
