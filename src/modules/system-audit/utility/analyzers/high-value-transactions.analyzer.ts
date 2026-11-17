import { z } from 'zod';
import { AnalysisType, ExceptionSeverity } from '../../domain/enum/system-audit.enum';
import { AnalysisRecord, AnalyzerContext, AnalyzerDefinition, AnalysisResult, ExceptionDraft } from '../../domain/entity/system-audit.entity';
import { round } from '../system-audit.utility';
import { koboToNaira, naira, norm, toKobo, toTransactions, TRANSACTION_FIELDS, Txn } from './financial-common';

// Reporting-spec rules this implements (IAMS Reports Requirements §1.7, §1.8, §2, §6):
//  • every INDIVIDUAL transaction strictly above the threshold is reported;
//  • exactly the threshold does not qualify ("above" means above);
//  • separate or related transactions are never added together to reach the threshold;
//  • the thresholds are configurable, and the defaults below are only defaults.
export const DEFAULT_HIGH_VALUE_THRESHOLD = 5_000_000;
export const DEFAULT_HIGH_VALUE_EXPENDITURE_THRESHOLD = 10_000_000;

const CategoryRuleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  /** Account-code prefixes that belong to this category (GBB's chart of accounts). */
  accountCodePrefixes: z.array(z.string().trim().min(1).max(40)).max(50).default([]),
  /** Words found in the category, account name or description. */
  keywords: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
});
export type ExpenditureCategoryRule = z.infer<typeof CategoryRuleSchema>;

/**
 * The nine categories named in spec §2. Keywords are a sensible starting point; GBB should
 * add the real account-code prefixes from Dynafin's chart of accounts once known (the
 * `categories` parameter is editable per run). Order matters: the first match wins, so
 * Diesel is tried before Fuelling.
 */
export const DEFAULT_EXPENDITURE_CATEGORIES: ExpenditureCategoryRule[] = [
  { name: 'Local and Foreign Travel Costs', accountCodePrefixes: [], keywords: ['travel', 'airfare', 'flight', 'per diem', 'hotel', 'accommodation'] },
  { name: 'Diesel Costs', accountCodePrefixes: [], keywords: ['diesel'] },
  { name: 'Fuelling Costs', accountCodePrefixes: [], keywords: ['fuelling', 'fueling', 'petrol'] },
  { name: 'Motor Vehicle Maintenance', accountCodePrefixes: [], keywords: ['vehicle maintenance', 'motor vehicle', 'vehicle repair', 'auto repair'] },
  { name: 'Network Equipment Maintenance', accountCodePrefixes: [], keywords: ['network equipment', 'network maintenance', 'router', 'switch maintenance'] },
  { name: 'Computer Equipment', accountCodePrefixes: [], keywords: ['computer equipment', 'laptop', 'desktop', 'server hardware'] },
  { name: 'Local and Foreign Staff Training', accountCodePrefixes: [], keywords: ['training', 'workshop', 'seminar', 'course fee'] },
  { name: 'Entertainment and Refreshments', accountCodePrefixes: [], keywords: ['entertainment', 'refreshment', 'catering', 'hospitality'] },
  { name: 'Inventory', accountCodePrefixes: [], keywords: ['inventory', 'stock', 'stores'] },
];

const ParametersSchema = z.object({
  /** `all` = spec §1.7 (every transaction); `expenditure` = spec §1.8/§2 (the nine categories only). */
  mode: z.enum(['all', 'expenditure']).default('all'),
  /** Used when mode is `all`. */
  threshold: z.number().min(0).default(DEFAULT_HIGH_VALUE_THRESHOLD),
  /** Used when mode is `expenditure`. */
  expenditureThreshold: z.number().min(0).default(DEFAULT_HIGH_VALUE_EXPENDITURE_THRESHOLD),
  categories: z.array(CategoryRuleSchema).max(30).default(DEFAULT_EXPENDITURE_CATEGORIES),
});
export type HighValueParameters = z.infer<typeof ParametersSchema>;

/** First match wins: exact category name, then account-code prefix, then keyword. */
export const classifyExpenditure = (t: Pick<Txn, 'category' | 'accountCode' | 'accountName' | 'description'>, rules: ExpenditureCategoryRule[]): string | null => {
  const category = norm(t.category);
  if (category) {
    const exact = rules.find((r) => norm(r.name) === category);
    if (exact) return exact.name;
  }
  const code = (t.accountCode ?? '').trim();
  if (code) {
    const byCode = rules.find((r) => r.accountCodePrefixes.some((p) => code.startsWith(p)));
    if (byCode) return byCode.name;
  }
  const haystack = norm(`${t.category ?? ''} ${t.accountName ?? ''} ${t.description ?? ''}`);
  const byWord = rules.find((r) => r.keywords.some((k) => haystack.includes(norm(k))));
  return byWord?.name ?? null;
};

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const severityFor = (kobo: number, limit: number): ExceptionSeverity =>
  kobo > limit * 5 ? ExceptionSeverity.Critical : kobo > limit * 2 ? ExceptionSeverity.High : ExceptionSeverity.Medium;

const analyse = (records: AnalysisRecord[], params: HighValueParameters, context: AnalyzerContext): AnalysisResult => {
  const { txns, unreadable } = toTransactions(records);
  const expenditure = params.mode === 'expenditure';
  const limit = toKobo(expenditure ? params.expenditureThreshold : params.threshold);
  const has = (field: string): boolean => context.mappedFields.has(field);
  const ruleCode = expenditure ? 'HIGH_VALUE_EXPENDITURE' : 'HIGH_VALUE_TRANSACTION';

  const exceptions: ExceptionDraft[] = [];
  const byCategory = new Map<string, number>();
  let qualifying = 0;
  let qualifyingKobo = 0;
  let largest = 0;
  let uncategorised = 0;
  let missingApprover = 0;
  let selfApproved = 0;
  let missingSupport = 0;

  for (const t of txns) {
    // STRICTLY above — a transaction of exactly the threshold does not qualify (spec §6.4).
    if (t.kobo <= limit) continue;

    const category = classifyExpenditure(t, params.categories);
    if (expenditure && !category) {
      uncategorised += 1;
      continue;
    }

    qualifying += 1;
    qualifyingKobo += t.kobo;
    largest = Math.max(largest, t.kobo);
    if (category) byCategory.set(category, (byCategory.get(category) ?? 0) + 1);

    const amount = koboToNaira(t.kobo);
    const base = {
      reference: t.reference,
      postingDate: t.postedAt.toISOString(),
      amount,
      accountCode: t.accountCode,
      description: t.description,
      payee: t.payee,
      department: t.department,
      postedBy: t.postedBy,
      approvedBy: t.approvedBy,
      supportingRef: t.supportingRef,
      category,
      row: t.row,
    };
    exceptions.push({
      ruleCode,
      severity: severityFor(t.kobo, limit),
      title: `${t.reference}: ${naira(amount)} to ${t.payee ?? 'an unnamed payee'}${category ? ` (${category})` : ''} — above ${naira(koboToNaira(limit))}`,
      recordRef: t.reference,
      details: base,
    });

    if (has('approved_by')) {
      if (!t.approvedBy) {
        missingApprover += 1;
        exceptions.push({
          ruleCode: 'MISSING_APPROVER',
          severity: ExceptionSeverity.High,
          title: `${t.reference} (${naira(amount)}) has no approver recorded`,
          recordRef: t.reference,
          details: base,
        });
      } else if (has('posted_by') && t.postedBy && norm(t.postedBy) === norm(t.approvedBy)) {
        selfApproved += 1;
        exceptions.push({
          ruleCode: 'SELF_APPROVED',
          severity: ExceptionSeverity.High,
          title: `${t.reference} (${naira(amount)}) was posted and approved by the same person (${t.postedBy})`,
          recordRef: t.reference,
          details: base,
        });
      }
    }

    if ((has('supporting_ref') || has('invoice_number')) && !t.supportingRef && !t.invoiceNumber) {
      missingSupport += 1;
      exceptions.push({
        ruleCode: 'MISSING_SUPPORT',
        severity: ExceptionSeverity.Medium,
        title: `${t.reference} (${naira(amount)}) has no supporting document or invoice reference`,
        recordRef: t.reference,
        details: base,
      });
    }
  }

  return {
    summary: {
      mode: params.mode,
      thresholdUsed: koboToNaira(limit),
      transactions: txns.length,
      qualifying,
      qualifyingValue: round(koboToNaira(qualifyingKobo), 2),
      largestAmount: round(koboToNaira(largest), 2),
      missingApprover,
      selfApproved,
      missingSupport,
      ...(expenditure && { uncategorisedAboveThreshold: uncategorised }),
      unreadableRows: unreadable,
      ...Object.fromEntries([...byCategory].map(([name, count]) => [`category_${slug(name)}`, count])),
    },
    exceptions,
  };
};

export const highValueTransactionsAnalyzer: AnalyzerDefinition<HighValueParameters> = {
  type: AnalysisType.HighValueTransactions,
  label: 'High-value transactions & expenditure',
  description:
    'Lists every individual transaction strictly above a threshold (₦5,000,000 by default), or — in expenditure mode — above ₦10,000,000 within the nine named expenditure categories. Transactions are never added together, and an amount exactly equal to the threshold does not qualify. Also flags missing approvers, posting and approval by the same person, and missing supporting references.',
  controls: ['FIN-AP-001'],
  fields: TRANSACTION_FIELDS,
  parametersSchema: ParametersSchema,
  rules: [
    { code: 'HIGH_VALUE_TRANSACTION', label: 'Individual transaction above the threshold', severity: 'varies' },
    { code: 'HIGH_VALUE_EXPENDITURE', label: 'Individual expenditure above the threshold in a named category', severity: 'varies' },
    { code: 'MISSING_APPROVER', label: 'High-value transaction with no approver', severity: ExceptionSeverity.High },
    { code: 'SELF_APPROVED', label: 'Posted and approved by the same person', severity: ExceptionSeverity.High },
    { code: 'MISSING_SUPPORT', label: 'High-value transaction without supporting reference', severity: ExceptionSeverity.Medium },
  ],
  analyse,
};
