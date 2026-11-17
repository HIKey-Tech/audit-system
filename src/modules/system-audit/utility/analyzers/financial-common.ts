// Shared pieces of the Dynafin financial analyses: the transaction columns an export (or
// the live driver) supplies, and money helpers.
//
// Money is compared in whole kobo (integer) so thresholds are exact: "strictly above
// ₦5,000,000" must be false for 5,000,000.00 and true for 5,000,000.01, which floating-point
// comparison does not guarantee.
import { AnalysisField, AnalysisRecord } from '../../domain/entity/system-audit.entity';

/** Naira → kobo, rounded (avoids 0.1 + 0.2 style drift). */
export const toKobo = (naira: number): number => Math.round(naira * 100);

/** Absolute transaction value in kobo; null when there is no readable amount. */
export const amountKobo = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? Math.abs(toKobo(value)) : null;

export const koboToNaira = (kobo: number): number => kobo / 100;

export const naira = (n: number): string =>
  `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
export const dateOf = (v: unknown): Date | null => (v instanceof Date && !Number.isNaN(v.getTime()) ? v : null);

/** Calendar day key (UTC) for grouping postings made on the same day. */
export const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

/** Lower-case, collapsed-whitespace key for matching names and references. */
export const norm = (v: unknown): string => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Columns shared by every transaction-based analysis. Keys match DynafinTransaction. */
export const TRANSACTION_FIELDS: AnalysisField[] = [
  { key: 'reference', label: 'Transaction reference', kind: 'text', required: true, synonyms: ['reference', 'ref', 'journal number', 'journal no', 'voucher number', 'voucher no', 'posting reference', 'transaction id', 'transaction ref', 'transaction reference', 'id'] },
  { key: 'posting_date', label: 'Posting date', kind: 'date', required: true, synonyms: ['posting date', 'date', 'transaction date', 'posted at', 'posted date', 'value date', 'trans date'] },
  { key: 'amount', label: 'Amount (₦)', kind: 'number', required: true, synonyms: ['amount', 'value', 'transaction amount', 'net amount', 'debit', 'total', 'amount ngn', 'amount (ngn)', 'amount (₦)'] },
  { key: 'account_code', label: 'Account code', kind: 'text', required: false, synonyms: ['account code', 'account', 'gl code', 'ledger code', 'account number', 'gl account'] },
  { key: 'account_name', label: 'Account name', kind: 'text', required: false, synonyms: ['account name', 'account description', 'gl name', 'ledger name', 'account title'] },
  { key: 'expense_category', label: 'Expense category', kind: 'text', required: false, synonyms: ['expense category', 'category', 'expenditure category', 'expense type', 'nature', 'expense head'] },
  { key: 'description', label: 'Description', kind: 'text', required: false, synonyms: ['description', 'narration', 'narrative', 'remarks', 'details', 'particulars'] },
  { key: 'payee', label: 'Vendor / payee', kind: 'text', required: false, synonyms: ['payee', 'vendor', 'vendor name', 'supplier', 'supplier name', 'beneficiary', 'paid to'] },
  { key: 'department', label: 'Department / cost centre', kind: 'text', required: false, synonyms: ['department', 'cost centre', 'cost center', 'cost centre name', 'unit', 'dept'] },
  { key: 'posted_by', label: 'Posted by', kind: 'text', required: false, synonyms: ['posted by', 'posting user', 'created by', 'entered by', 'user', 'prepared by'] },
  { key: 'approved_by', label: 'Approved by', kind: 'text', required: false, synonyms: ['approved by', 'approver', 'authorised by', 'authorized by', 'approved'] },
  { key: 'supporting_ref', label: 'Supporting reference', kind: 'text', required: false, synonyms: ['supporting ref', 'supporting reference', 'po number', 'po no', 'purchase order', 'document reference', 'supporting document'] },
  { key: 'invoice_number', label: 'Invoice number', kind: 'text', required: false, synonyms: ['invoice number', 'invoice no', 'invoice', 'invoice ref', 'invoice reference'] },
  { key: 'is_reversal', label: 'Is reversal', kind: 'boolean', required: false, synonyms: ['reversal', 'is reversal', 'reversed', 'reversal flag'] },
];

/** A transaction row that has the three essentials, ready for analysis. */
export interface Txn {
  row: number;
  reference: string;
  postedAt: Date;
  kobo: number;
  accountCode: string | null;
  accountName: string | null;
  category: string | null;
  description: string | null;
  payee: string | null;
  department: string | null;
  postedBy: string | null;
  approvedBy: string | null;
  supportingRef: string | null;
  invoiceNumber: string | null;
  isReversal: boolean;
}

/** Rows lacking a reference, date or amount cannot be analysed — they are counted, never guessed at. */
export const toTransactions = (records: AnalysisRecord[]): { txns: Txn[]; unreadable: number } => {
  const txns: Txn[] = [];
  let unreadable = 0;
  for (const r of records) {
    const v = r.values;
    const reference = text(v.reference);
    const postedAt = dateOf(v.posting_date);
    const kobo = amountKobo(v.amount);
    if (!reference || !postedAt || kobo === null) {
      unreadable += 1;
      continue;
    }
    txns.push({
      row: r.rowNumber,
      reference,
      postedAt,
      kobo,
      accountCode: text(v.account_code),
      accountName: text(v.account_name),
      category: text(v.expense_category),
      description: text(v.description),
      payee: text(v.payee),
      department: text(v.department),
      postedBy: text(v.posted_by),
      approvedBy: text(v.approved_by),
      supportingRef: text(v.supporting_ref),
      invoiceNumber: text(v.invoice_number),
      isReversal: v.is_reversal === true,
    });
  }
  return { txns, unreadable };
};
