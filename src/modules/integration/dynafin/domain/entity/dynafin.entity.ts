// The Dynafin data contract — what IAMS needs from GBB's finance system.
//
// These are IAMS's own canonical shapes, deliberately independent of Dynafin's wire
// format. The HTTP driver maps whatever Dynafin eventually returns onto these in one
// place (utility/dynafin.utility.ts), and everything downstream — the financial
// analyses, monitoring, exports — only ever sees these types. The same fields are the
// columns a Dynafin CSV/Excel export may carry for a manual upload.
//
// Strictly read-only: nothing here can be written back to Dynafin.

/** All amounts are Naira unless `currency` says otherwise. */
export const DYNAFIN_DEFAULT_CURRENCY = 'NGN';

/** One individual ledger posting / payment. Thresholds apply per transaction, never to a sum. */
export interface DynafinTransaction {
  /** Posting / journal / voucher reference. The primary identity of the transaction. */
  reference: string;
  /** ISO 8601 date-time (or date) the transaction was posted. */
  postingDate: string;
  /** Absolute value of the transaction. */
  amount: number;
  currency: string;
  accountCode: string | null;
  accountName: string | null;
  /** Dynafin's own expense classification, when it carries one. */
  expenseCategory: string | null;
  description: string | null;
  /** Vendor / payee / beneficiary. */
  payee: string | null;
  /** Department or cost centre. */
  department: string | null;
  postedBy: string | null;
  approvedBy: string | null;
  /** Supporting document reference (PO, voucher, contract). */
  supportingRef: string | null;
  invoiceNumber: string | null;
  isReversal: boolean;
}

/** One staff advance and what has been done to retire it. */
export interface DynafinStaffAdvance {
  advanceId: string;
  employee: string;
  employeeId: string | null;
  /** ISO 8601 date-time the advance was issued. */
  issuedAt: string;
  amount: number;
  retiredAmount: number;
  refundedAmount: number;
  /** ISO 8601 date-time of the last retirement, or null while none has happened. */
  retiredAt: string | null;
  purpose: string | null;
}

/** Inclusive reporting window, ISO 8601 dates. */
export interface DynafinPeriodQuery {
  from: string;
  to: string;
}

export interface DynafinStatus {
  reachable: boolean;
  authenticated: boolean;
  lastError: string | null;
  checkedAt: string;
}

export interface DynafinConnectionInfo {
  enabled: boolean;
  configured: boolean;
  driver: 'http' | 'fixture' | 'disabled';
  /** True when the data is made-up demo data (fixture driver). Never true in production. */
  sampleData: boolean;
}
