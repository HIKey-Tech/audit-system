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

export const humanizeStatus = (status: string | null | undefined): string => {
  if (!status) return '—';
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
