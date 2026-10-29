// Skill-matching helpers shared by ManageAssignmentsSlideOver and StartAuditWizard.

export const AUDIT_TYPE_KEYWORDS: Record<string, string[]> = {
  it: ['it', 'cyber', 'security', 'iso 27001', 'iso27001', 'network', 'system', 'vulnerability', 'firewall', 'cloud', 'itgc', 'sast', 'systems', 'infrastructure', 'configuration', 'change', 'cab', 'disaster', 'dr', 'replication', 'capacity', 'performance'],
  systems: ['systems', 'system', 'infrastructure', 'configuration', 'baseline', 'change', 'cab', 'disaster', 'dr', 'replication', 'capacity', 'performance', 'iso 22301', 'it'],
  financial: ['financial', 'finance', 'ap', 'ledger', 'reconciliation', 'maker', 'checker', 'asset', 'audit', 'tax', 'accounting', 'ifrs', 'ipsas', 'treasury'],
  compliance: ['compliance', 'regulation', 'standard', 'iso 9001', 'iso9001', 'iso 22301', 'iso22301', 'ndpr', 'privacy', 'dpo', 'policy', 'gdpr', 'regulatory'],
  operational: ['operational', 'operations', 'process', 'sop', 'kpi', 'sla', 'ola', 'efficiency', 'quality', 'service'],
  pension: ['pension', 'pencom', 'pra', 'pfa', 'pfc', 'rsa', 'retirement', 'payroll', 'finance', 'hr', 'compliance'],
  procurement: ['procurement', 'ppa', 'bpp', 'vendor', 'tender', 'bidding', 'contract', 'supply', 'purchasing', 'financial'],
  hr_payroll: ['hr', 'payroll', 'personnel', 'nominal', 'paye', 'tax', 'pension', 'nhf', 'nsitf', 'remuneration', 'benefits'],
  project: ['project', 'capital', 'capex', 'pmp', 'prince2', 'milestone', 'engineering', 'infrastructure', 'contract', 'governance'],
  special: ['special', 'investigation', 'forensic', 'fraud', 'ethics', 'whistleblowing', 'audit', 'compliance'],
};

/** Total skill-match score for a candidate against an audit type. */
export const getMatchScore = (skills: string[], auditType: string): number => {
  const matchWords = AUDIT_TYPE_KEYWORDS[auditType.toLowerCase()] ?? [];
  let score = 0;
  skills.forEach((skill) => {
    const s = skill.toLowerCase();
    if (matchWords.some((w) => s.includes(w))) score += 2;
  });
  return score;
};

/** Whether a single skill is relevant to the audit type. */
export const isRelevantSkill = (skill: string, auditType: string): boolean => {
  const matchWords = AUDIT_TYPE_KEYWORDS[auditType.toLowerCase()] ?? [];
  const s = skill.toLowerCase();
  return matchWords.some((w) => s.includes(w));
};
