// Single source of truth for the status → color mapping defined in the spec.

export type StatusToneKey =
  | 'planned'
  | 'in_progress'
  | 'under_review'
  | 'reported'
  | 'closed'
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'informational'
  | 'open'
  | 'verified'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'issued'
  | 'draft'
  | 'submitted'
  | 'mitigated'
  | 'accepted'
  | 'success'
  | 'failure'
  | 'active'
  | 'inactive'
  | 'management_response_received'
  | 'in_remediation'
  | 'not_tested'
  | 'passed'
  | 'failed'
  | 'not_applicable';

interface ToneStyle {
  bg: string;
  text: string;
  ring: string;
  dot: string;
  hex: string;
}

// Tailwind class-based tones. Aligned with the spec's status colour mapping.
const TONES: Record<string, ToneStyle> = {
  gray: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    ring: 'ring-slate-200',
    dot: 'bg-slate-500',
    hex: '#64748B',
  },
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    ring: 'ring-blue-200',
    dot: 'bg-blue-600',
    hex: '#2563EB',
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    ring: 'ring-amber-200',
    dot: 'bg-amber-600',
    hex: '#D97706',
  },
  purple: {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    ring: 'ring-violet-200',
    dot: 'bg-violet-600',
    hex: '#7C3AED',
  },
  green: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
    dot: 'bg-emerald-600',
    hex: '#16A34A',
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    ring: 'ring-red-200',
    dot: 'bg-red-600',
    hex: '#DC2626',
  },
  orange: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    ring: 'ring-orange-200',
    dot: 'bg-orange-600',
    hex: '#EA580C',
  },
  yellow: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-800',
    ring: 'ring-yellow-200',
    dot: 'bg-yellow-500',
    hex: '#CA8A04',
  },
};

const STATUS_TONE: Record<StatusToneKey, keyof typeof TONES> = {
  planned: 'gray',
  in_progress: 'blue',
  under_review: 'amber',
  reported: 'purple',
  closed: 'green',
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'green',
  informational: 'gray',
  open: 'red',
  verified: 'green',
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  issued: 'blue',
  draft: 'gray',
  submitted: 'blue',
  mitigated: 'green',
  accepted: 'gray',
  success: 'green',
  failure: 'red',
  active: 'green',
  inactive: 'gray',
  management_response_received: 'blue',
  in_remediation: 'amber',
  not_tested: 'gray',
  passed: 'green',
  failed: 'red',
  not_applicable: 'gray',
};

const FALLBACK = TONES.gray;

export const statusTone = (status: string | null | undefined): ToneStyle => {
  if (!status) return FALLBACK;
  const key = status.toLowerCase().replace(/\s+/g, '_') as StatusToneKey;
  const tone = STATUS_TONE[key];
  return tone ? TONES[tone] : FALLBACK;
};

/**
 * Statuses whose humanized form would read wrong. The engagement report is now
 * called a "review", so the two engagement stages that used to say "Under
 * Review" / "Reported" are relabelled to keep them distinct from it.
 */
const STATUS_LABELS: Record<string, string> = {
  under_review: 'Quality Assurance',
  reported: 'Review Issued',
};

export const humanizeStatus = (status: string | null | undefined): string => {
  if (!status) return '—';
  const key = status.toLowerCase().replace(/\s+/g, '_');
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const riskScoreTone = (score: number): ToneStyle => {
  if (score >= 20) return TONES.red;
  if (score >= 13) return TONES.orange;
  if (score >= 6) return TONES.yellow;
  return TONES.green;
};

export const riskScoreLabel = (score: number): string => {
  if (score >= 20) return 'Critical';
  if (score >= 13) return 'High';
  if (score >= 6) return 'Medium';
  return 'Low';
};

// ─────────────────────────────────────────────────────────────
// RAG (Red / Amber / Green) status for target-based KPIs.
// Thresholds follow standard internal-audit committee reporting:
// green = on target, amber = watch, red = off target.
// ─────────────────────────────────────────────────────────────
export type RagLevel = 'green' | 'amber' | 'red';

interface RagStyle {
  level: RagLevel;
  label: string;
  dot: string;   // solid bg for the traffic-light dot
  text: string;  // text colour for the value/hint
  bar: string;   // solid bg for progress/gauge fill
  track: string; // faint track behind the gauge
}

const RAG_STYLES: Record<RagLevel, RagStyle> = {
  green: { level: 'green', label: 'On target', dot: 'bg-emerald-500', text: 'text-emerald-700', bar: 'bg-emerald-500', track: 'bg-emerald-100' },
  amber: { level: 'amber', label: 'Watch', dot: 'bg-amber-500', text: 'text-amber-700', bar: 'bg-amber-500', track: 'bg-amber-100' },
  red: { level: 'red', label: 'Off target', dot: 'bg-red-500', text: 'text-red-700', bar: 'bg-red-500', track: 'bg-red-100' },
};

/**
 * RAG for a "higher is better" percentage KPI (e.g. completion / coverage rate).
 * Defaults to the audit-committee standard: ≥85 green, 70–85 amber, <70 red.
 */
export const ragForRate = (
  value: number,
  green = 85,
  amber = 70,
): RagStyle => {
  if (value >= green) return RAG_STYLES.green;
  if (value >= amber) return RAG_STYLES.amber;
  return RAG_STYLES.red;
};

/**
 * RAG for a "lower is better" count KPI (e.g. overdue items): 0 is green,
 * up to `amberMax` is amber, anything more is red.
 */
export const ragForCount = (value: number, amberMax = 3): RagStyle => {
  if (value <= 0) return RAG_STYLES.green;
  if (value <= amberMax) return RAG_STYLES.amber;
  return RAG_STYLES.red;
};

export type StatusEntity =
  | 'engagement'
  | 'finding'
  | 'report'
  | 'plan'
  | 'working_paper'
  | 'approval';

export interface StatusMeaning {
  label: string;   // humanized status
  meaning: string; // what this status means, plain English
  next?: string;   // what advances it to the next state
}

// entity -> normalized status key -> meaning. Keys are lower_snake_case.
const STATUS_MEANINGS: Record<StatusEntity, Record<string, Omit<StatusMeaning, 'label'>>> = {
  engagement: {
    planned: { meaning: 'Scheduled but fieldwork has not started.', next: 'Assign the team and mark it in progress to begin.' },
    in_progress: { meaning: 'Fieldwork is underway; working papers and evidence are being captured.', next: 'Complete checklists and get working papers approved to move to quality assurance.' },
    under_review: { meaning: 'Fieldwork is done and the work is undergoing quality assurance.', next: 'Generate and issue the review to move it on.' },
    reported: { meaning: 'The audit review has been issued to stakeholders.', next: 'Verify and close all findings to close the engagement.' },
    closed: { meaning: 'The engagement is complete and all findings are resolved.' },
  },
  finding: {
    open: { meaning: 'Raised and awaiting a management response.', next: 'Record the management response.' },
    management_response_received: { meaning: 'Management has responded with a remediation plan.', next: 'Begin remediation.' },
    in_remediation: { meaning: 'Corrective action is in progress.', next: 'Submit remediation evidence for verification.' },
    verified: { meaning: 'Remediation evidence has been verified by audit.', next: 'Close the finding.' },
    closed: { meaning: 'The finding is fully resolved and closed.' },
  },
  report: {
    draft: { meaning: 'Being prepared; not yet submitted.', next: 'Submit for approval.' },
    submitted: { meaning: 'Submitted and awaiting approval.', next: 'Approver acts on the current level.' },
    approved: { meaning: 'Approved through all levels but not yet issued.', next: 'Issue the review.' },
    rejected: { meaning: 'Sent back by an approver with a reason.', next: 'Address the reason and resubmit.' },
    issued: { meaning: 'Finalised and distributed to stakeholders.' },
  },
  plan: {
    draft: { meaning: 'Being assembled; plans can still be added.', next: 'Submit for approval.' },
    submitted: { meaning: 'Submitted and awaiting approval.', next: 'Approver reviews the programme.' },
    approved: { meaning: 'Approved; engagements can be created from its plans.', next: 'Create engagements from the programme’s plans.' },
    rejected: { meaning: 'Returned by an approver with a reason.', next: 'Revise and resubmit.' },
  },
  working_paper: {
    draft: { meaning: 'Editable; not yet submitted for review.', next: 'Submit for review.' },
    submitted: { meaning: 'Awaiting reviewer approval.', next: 'Reviewer approves or rejects.' },
    approved: { meaning: 'Reviewed and locked.' },
    rejected: { meaning: 'Returned by the reviewer with a comment.', next: 'Address the comment and resubmit.' },
  },
  approval: {
    pending: { meaning: 'Awaiting a decision at the current level.', next: 'The current-level approver acts.' },
    approved: { meaning: 'Approved at this level / overall.' },
    rejected: { meaning: 'Rejected with a reason.' },
    cancelled: { meaning: 'The approval request was cancelled.' },
  },
};

/** Returns the next engagement status in the lifecycle, or null if already closed. */
export function nextEngagementStatus(status: string): string | null {
  const transitions: Record<string, string> = {
    planned: 'in_progress',
    in_progress: 'under_review',
    under_review: 'reported',
    reported: 'closed',
  };
  return transitions[status] ?? null;
}

export const statusMeaning = (
  entity: StatusEntity,
  status: string | null | undefined,
): StatusMeaning => {
  const label = humanizeStatus(status);
  if (!status) return { label, meaning: 'No status set.' };
  const key = status.toLowerCase().replace(/\s+/g, '_');
  const found = STATUS_MEANINGS[entity]?.[key];
  return found ? { label, ...found } : { label, meaning: label };
};
