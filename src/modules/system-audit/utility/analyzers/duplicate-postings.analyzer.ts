import { z } from 'zod';
import { AnalysisType, ExceptionSeverity } from '../../domain/enum/system-audit.enum';
import { AnalysisRecord, AnalyzerContext, AnalyzerDefinition, AnalysisResult, ExceptionDraft } from '../../domain/entity/system-audit.entity';
import { round } from '../system-audit.utility';
import { dayKey, koboToNaira, naira, norm, toKobo, toTransactions, TRANSACTION_FIELDS, Txn } from './financial-common';
import { DEFAULT_HIGH_VALUE_THRESHOLD } from './high-value-transactions.analyzer';

// Spec §1.6 (daily duplicate-posting alert) and §1.13 (monthly duplicate and unusual payments).
const ParametersSchema = z.object({
  /**
   * A payee paid in several pieces on one day is reported when every piece is below this
   * amount and the pieces together exceed it — the signature of a split to stay under an
   * approval limit. Defaults to the high-value threshold.
   */
  splitThreshold: z.number().min(0).default(DEFAULT_HIGH_VALUE_THRESHOLD),
  minSplitCount: z.number().int().min(2).max(50).default(2),
});
export type DuplicatePostingsParameters = z.infer<typeof ParametersSchema>;

const MAX_LISTED = 25;

const group = <T>(items: T[], keyOf: (item: T) => string | null): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (key === null) continue;
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
};

const refs = (txns: Txn[]): Array<{ reference: string; amount: number; postingDate: string; row: number }> =>
  txns.slice(0, MAX_LISTED).map((t) => ({ reference: t.reference, amount: koboToNaira(t.kobo), postingDate: t.postedAt.toISOString(), row: t.row }));

/** Everything except the first posting in a group is the exposure. */
const extraKobo = (txns: Txn[]): number => txns.slice(1).reduce((n, t) => n + t.kobo, 0);

const analyse = (records: AnalysisRecord[], params: DuplicatePostingsParameters, context: AnalyzerContext): AnalysisResult => {
  const { txns, unreadable } = toTransactions(records);
  const has = (field: string): boolean => context.mappedFields.has(field);
  const posted = txns.filter((t) => !t.isReversal);
  const exceptions: ExceptionDraft[] = [];
  const flaggedRows = new Set<number>();
  let valueAtRisk = 0;
  let referenceGroups = 0;
  let invoiceGroups = 0;
  let sameAmountGroups = 0;
  let reversals = 0;
  let splitGroups = 0;

  // 1) The same reference posted more than once.
  for (const [, rows] of group(posted, (t) => norm(t.reference))) {
    if (rows.length < 2) continue;
    referenceGroups += 1;
    valueAtRisk += extraKobo(rows);
    rows.forEach((t) => flaggedRows.add(t.row));
    exceptions.push({
      ruleCode: 'DUPLICATE_REFERENCE',
      severity: ExceptionSeverity.High,
      title: `Reference "${rows[0].reference}" is posted ${rows.length} times (${naira(koboToNaira(rows[0].kobo))} each)`,
      recordRef: rows[0].reference,
      details: { count: rows.length, postings: refs(rows), payee: rows[0].payee },
    });
  }

  // 2) The same vendor's invoice number posted under different references.
  if (has('invoice_number') && has('payee')) {
    const keyed = posted.filter((t) => t.invoiceNumber && t.payee);
    for (const [key, rows] of group(keyed, (t) => `${norm(t.payee)}|${norm(t.invoiceNumber)}`)) {
      const distinct = new Set(rows.map((t) => norm(t.reference)));
      if (rows.length < 2 || distinct.size < 2) continue;
      invoiceGroups += 1;
      valueAtRisk += extraKobo(rows);
      rows.forEach((t) => flaggedRows.add(t.row));
      exceptions.push({
        ruleCode: 'DUPLICATE_INVOICE',
        severity: ExceptionSeverity.High,
        title: `Invoice "${rows[0].invoiceNumber}" from ${rows[0].payee} was posted ${rows.length} times under different references`,
        recordRef: key.slice(0, 500),
        details: { invoiceNumber: rows[0].invoiceNumber, payee: rows[0].payee, postings: refs(rows) },
      });
    }
  }

  // 3) Same amount, account, day and payee — likely re-keyed. Skipped when every posting is already flagged above.
  for (const [key, rows] of group(posted, (t) =>
    `${t.kobo}|${has('account_code') ? norm(t.accountCode) : ''}|${dayKey(t.postedAt)}|${has('payee') ? norm(t.payee) : ''}`,
  )) {
    if (rows.length < 2 || rows.every((t) => flaggedRows.has(t.row))) continue;
    sameAmountGroups += 1;
    valueAtRisk += extraKobo(rows);
    rows.forEach((t) => flaggedRows.add(t.row));
    exceptions.push({
      ruleCode: 'SAME_AMOUNT_ACCOUNT_DATE_PAYEE',
      severity: ExceptionSeverity.Medium,
      title: `${rows.length} postings of ${naira(koboToNaira(rows[0].kobo))}${rows[0].payee ? ` to ${rows[0].payee}` : ''} on ${dayKey(rows[0].postedAt)} share the same account`,
      recordRef: key.slice(0, 500),
      details: { count: rows.length, accountCode: rows[0].accountCode, postings: refs(rows) },
    });
  }

  // 4) Reversals, matched to the posting they appear to undo.
  if (has('is_reversal')) {
    for (const r of txns.filter((t) => t.isReversal)) {
      reversals += 1;
      const original = posted
        .filter((t) => t.kobo === r.kobo && norm(t.payee) === norm(r.payee) && t.postedAt <= r.postedAt)
        .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime())[0];
      exceptions.push({
        ruleCode: 'REVERSAL',
        severity: ExceptionSeverity.Low,
        title: `Reversal ${r.reference} of ${naira(koboToNaira(r.kobo))}${r.payee ? ` for ${r.payee}` : ''}${original ? ` appears to reverse ${original.reference}` : ' has no matching original posting'}`,
        recordRef: r.reference,
        details: { reversal: refs([r])[0], original: original ? refs([original])[0] : null },
      });
    }
  }

  // 5) Split payments: several under-limit payments to one payee on one day that together exceed the limit.
  if (has('payee')) {
    const limit = toKobo(params.splitThreshold);
    const small = posted.filter((t) => t.payee && t.kobo < limit);
    for (const [key, rows] of group(small, (t) => `${norm(t.payee)}|${dayKey(t.postedAt)}`)) {
      const total = rows.reduce((n, t) => n + t.kobo, 0);
      if (rows.length < params.minSplitCount || total <= limit) continue;
      splitGroups += 1;
      exceptions.push({
        ruleCode: 'SPLIT_PAYMENT',
        severity: ExceptionSeverity.Medium,
        title: `${rows.length} payments to ${rows[0].payee} on ${dayKey(rows[0].postedAt)} are each under ${naira(koboToNaira(limit))} but total ${naira(koboToNaira(total))}`,
        recordRef: key.slice(0, 500),
        details: { payee: rows[0].payee, count: rows.length, total: koboToNaira(total), postings: refs(rows) },
      });
    }
  }

  return {
    summary: {
      transactions: txns.length,
      duplicateReferenceGroups: referenceGroups,
      duplicateInvoiceGroups: invoiceGroups,
      sameAmountGroups,
      reversals,
      splitPaymentGroups: splitGroups,
      valueAtRisk: round(koboToNaira(valueAtRisk), 2),
      unreadableRows: unreadable,
    },
    exceptions,
  };
};

export const duplicatePostingsAnalyzer: AnalyzerDefinition<DuplicatePostingsParameters> = {
  type: AnalysisType.DuplicatePostings,
  label: 'Duplicate & unusual postings',
  description:
    'Finds potential duplicate postings and payments — the same reference posted twice, the same vendor invoice under different references, identical amount/account/date/payee — plus reversals and payments split to stay under a limit. Intended for the daily duplicate-posting alert and the monthly unusual-payments review.',
  controls: ['FIN-AP-001'],
  fields: TRANSACTION_FIELDS,
  parametersSchema: ParametersSchema,
  rules: [
    { code: 'DUPLICATE_REFERENCE', label: 'Same reference posted more than once', severity: ExceptionSeverity.High },
    { code: 'DUPLICATE_INVOICE', label: 'Same vendor invoice posted under different references', severity: ExceptionSeverity.High },
    { code: 'SAME_AMOUNT_ACCOUNT_DATE_PAYEE', label: 'Same amount, account, date and payee', severity: ExceptionSeverity.Medium },
    { code: 'REVERSAL', label: 'Reversal needing review', severity: ExceptionSeverity.Low },
    { code: 'SPLIT_PAYMENT', label: 'Payments split below a limit', severity: ExceptionSeverity.Medium },
  ],
  analyse,
};
