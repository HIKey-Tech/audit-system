import { usePermissions } from '@/lib/hooks/usePermissions';

// Each type-specific auditor role and the audit types it normally covers.
const AUDITOR_ROLES: { role: string; label: string; types: string[] }[] = [
  { role: 'system_auditor', label: 'System Auditor', types: ['it', 'systems'] },
  { role: 'financial_auditor', label: 'Financial Auditor', types: ['financial'] },
  { role: 'compliance_auditor', label: 'Compliance Auditor', types: ['compliance'] },
];

const TYPE_LABEL: Record<string, string> = {
  it: 'an IT / System',
  systems: 'an IT / System',
  financial: 'a Financial',
  compliance: 'a Compliance',
};

/**
 * A heads-up (not a restriction) when an auditor starts an audit of a type that is not theirs, for example a
 * Financial Auditor starting a System audit. Returns the message to show, or null when there is nothing to warn about.
 * Oversight roles (Head, DG, admins) and audit types without a matching auditor role never trigger it.
 */
export const useAuditTypeMismatch = (auditType: string | null | undefined): string | null => {
  const { user } = usePermissions();
  if (!auditType || !TYPE_LABEL[auditType]) return null;
  const mine = AUDITOR_ROLES.filter((r) => user.roles.includes(r.role));
  if (mine.length === 0) return null;
  if (mine.some((r) => r.types.includes(auditType))) return null;
  const who = mine.map((r) => r.label).join(' / ');
  return `You are a ${who}, and this is ${TYPE_LABEL[auditType]} audit. You can still start it, but check that this is intended.`;
};
