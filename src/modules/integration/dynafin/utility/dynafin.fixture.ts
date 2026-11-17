// Sample Dynafin data for UAT, demos and tests. Every record is labelled SAMPLE.
//
// It is generated relative to the END of the requested window, so any recent period
// returns something to analyse. It deliberately includes the edge cases the reporting
// spec calls out so a demo (and the tests) exercise them:
//   • exactly ₦5,000,000 / ₦10,000,000  → NOT "above" the threshold
//   • ₦5,000,000.01 / ₦10,000,000.01    → qualifies
//   • each of the nine high-value expenditure categories
//   • duplicate reference, duplicate vendor+invoice, same amount+account+date+payee
//   • a reversal and a split payment (several under-threshold payments to one payee)
//   • staff advances: overdue, partly retired, repeat, and a clean one
//
// This module is only reachable through FixtureDynafinClient, which the factory refuses
// to construct in production.
import { DynafinStaffAdvance, DynafinTransaction } from '../domain/entity/dynafin.entity';

const utc = (to: Date, daysBack: number, hour = 10): string =>
  new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() - daysBack, hour, 0, 0)).toISOString();

interface TxnInput extends Partial<DynafinTransaction> {
  reference: string;
  amount: number;
  daysBack: number;
}

const txn = (to: Date, i: TxnInput): DynafinTransaction => ({
  reference: i.reference,
  postingDate: utc(to, i.daysBack),
  amount: i.amount,
  currency: 'NGN',
  accountCode: i.accountCode ?? '5000',
  accountName: i.accountName ?? 'General expenditure',
  expenseCategory: i.expenseCategory ?? null,
  description: i.description ?? `SAMPLE: ${i.reference}`,
  payee: i.payee ?? 'SAMPLE Vendor Ltd',
  department: i.department ?? 'Finance',
  postedBy: i.postedBy ?? 'sample.poster',
  approvedBy: i.approvedBy === undefined ? 'sample.approver' : i.approvedBy,
  supportingRef: i.supportingRef === undefined ? `PO-${i.reference}` : i.supportingRef,
  invoiceNumber: i.invoiceNumber ?? null,
  isReversal: i.isReversal ?? false,
});

export const buildFixtureTransactions = (to: Date): DynafinTransaction[] => [
  // ── Threshold boundaries (spec §6.4) ────────────────────────────────
  txn(to, { reference: 'SMP-0004', amount: 5_000_000, daysBack: 2, description: 'SAMPLE: exactly ₦5,000,000 — must NOT qualify' }),
  txn(to, { reference: 'SMP-0005', amount: 5_000_000.01, daysBack: 2, description: 'SAMPLE: ₦5,000,000.01 — qualifies for the high-value report' }),
  txn(to, { reference: 'SMP-0002', amount: 10_000_000, daysBack: 3, accountCode: '5210', accountName: 'Diesel', expenseCategory: 'Diesel Costs', description: 'SAMPLE: exactly ₦10,000,000 diesel — must NOT qualify' }),
  txn(to, { reference: 'SMP-0003', amount: 10_000_000.01, daysBack: 3, accountCode: '5210', accountName: 'Diesel', expenseCategory: 'Diesel Costs', payee: 'SAMPLE Fuel Depot' }),

  // ── The nine high-value expenditure categories (spec §2) ────────────
  txn(to, { reference: 'SMP-0001', amount: 12_500_000, daysBack: 1, accountCode: '5101', accountName: 'Travel – foreign', expenseCategory: 'Local and Foreign Travel Costs', payee: 'SAMPLE Travel Ltd' }),
  txn(to, { reference: 'SMP-0011', amount: 10_200_000, daysBack: 4, accountCode: '5211', accountName: 'Fuelling', expenseCategory: 'Fuelling Costs', payee: 'SAMPLE Filling Station' }),
  txn(to, { reference: 'SMP-0012', amount: 10_300_000, daysBack: 4, accountCode: '5220', accountName: 'Motor vehicle maintenance', expenseCategory: 'Motor Vehicle Maintenance', payee: 'SAMPLE Auto Works' }),
  txn(to, { reference: 'SMP-0006', amount: 14_200_000, daysBack: 5, accountCode: '5310', accountName: 'Network equipment maintenance', expenseCategory: 'Network Equipment Maintenance', approvedBy: null, description: 'SAMPLE: no approver recorded' }),
  txn(to, { reference: 'SMP-0007', amount: 11_000_000, daysBack: 5, accountCode: '1420', accountName: 'Computer equipment', expenseCategory: 'Computer Equipment', supportingRef: null, description: 'SAMPLE: no supporting reference' }),
  txn(to, { reference: 'SMP-0008', amount: 18_000_000, daysBack: 6, accountCode: '5410', accountName: 'Staff training – foreign', expenseCategory: 'Local and Foreign Staff Training', payee: 'SAMPLE Training Institute' }),
  txn(to, { reference: 'SMP-0009', amount: 10_500_000, daysBack: 6, accountCode: '5510', accountName: 'Entertainment and refreshments', expenseCategory: 'Entertainment and Refreshments', payee: 'SAMPLE Caterers' }),
  txn(to, { reference: 'SMP-0010', amount: 25_000_000, daysBack: 6, accountCode: '1310', accountName: 'Inventory', expenseCategory: 'Inventory', payee: 'SAMPLE Stores Ltd' }),

  // ── Duplicates ──────────────────────────────────────────────────────
  txn(to, { reference: 'SMP-0020', amount: 750_000, daysBack: 1, payee: 'SAMPLE Dup Co', description: 'SAMPLE: same reference posted twice' }),
  txn(to, { reference: 'SMP-0020', amount: 750_000, daysBack: 1, payee: 'SAMPLE Dup Co', description: 'SAMPLE: same reference posted twice' }),
  txn(to, { reference: 'SMP-0021', amount: 1_200_000, daysBack: 2, payee: 'SAMPLE Invoice Co', invoiceNumber: 'INV-5001', description: 'SAMPLE: same vendor + invoice number' }),
  txn(to, { reference: 'SMP-0022', amount: 1_200_000, daysBack: 3, payee: 'SAMPLE Invoice Co', invoiceNumber: 'INV-5001', description: 'SAMPLE: same vendor + invoice number' }),
  txn(to, { reference: 'SMP-0023', amount: 300_000, daysBack: 2, accountCode: '5600', payee: 'SAMPLE Twin Ltd', description: 'SAMPLE: same amount, account, date, payee' }),
  txn(to, { reference: 'SMP-0024', amount: 300_000, daysBack: 2, accountCode: '5600', payee: 'SAMPLE Twin Ltd', description: 'SAMPLE: same amount, account, date, payee' }),

  // ── Reversal and split payment ──────────────────────────────────────
  txn(to, { reference: 'SMP-0031', amount: 640_000, daysBack: 3, payee: 'SAMPLE Reversal Ltd' }),
  txn(to, { reference: 'SMP-0030', amount: 640_000, daysBack: 2, payee: 'SAMPLE Reversal Ltd', isReversal: true, description: 'SAMPLE: reversal of SMP-0031' }),
  txn(to, { reference: 'SMP-0040', amount: 4_000_000, daysBack: 1, payee: 'SAMPLE Split Vendor', description: 'SAMPLE: split payment 1 of 3' }),
  txn(to, { reference: 'SMP-0041', amount: 3_900_000, daysBack: 1, payee: 'SAMPLE Split Vendor', description: 'SAMPLE: split payment 2 of 3' }),
  txn(to, { reference: 'SMP-0042', amount: 4_200_000, daysBack: 1, payee: 'SAMPLE Split Vendor', description: 'SAMPLE: split payment 3 of 3' }),

  // ── Ordinary, unremarkable postings ─────────────────────────────────
  txn(to, { reference: 'SMP-0050', amount: 120_000, daysBack: 1 }),
  txn(to, { reference: 'SMP-0051', amount: 85_500.5, daysBack: 2 }),
];

export const buildFixtureStaffAdvances = (to: Date): DynafinStaffAdvance[] => [
  // Overdue: issued 10 days ago, nothing retired.
  { advanceId: 'SMP-ADV-01', employee: 'SAMPLE Staff One', employeeId: 'S001', issuedAt: utc(to, 10), amount: 200_000, retiredAmount: 0, refundedAmount: 0, retiredAt: null, purpose: 'SAMPLE: field trip' },
  // Partly retired and still short.
  { advanceId: 'SMP-ADV-02', employee: 'SAMPLE Staff Two', employeeId: 'S002', issuedAt: utc(to, 6), amount: 150_000, retiredAmount: 100_000, refundedAmount: 0, retiredAt: utc(to, 4), purpose: 'SAMPLE: workshop' },
  // Repeat: a second advance issued while the first is still unretired.
  { advanceId: 'SMP-ADV-03', employee: 'SAMPLE Staff Three', employeeId: 'S003', issuedAt: utc(to, 12), amount: 80_000, retiredAmount: 0, refundedAmount: 0, retiredAt: null, purpose: 'SAMPLE: logistics' },
  { advanceId: 'SMP-ADV-04', employee: 'SAMPLE Staff Three', employeeId: 'S003', issuedAt: utc(to, 5), amount: 60_000, retiredAmount: 0, refundedAmount: 0, retiredAt: null, purpose: 'SAMPLE: logistics (second advance)' },
  // Clean: fully retired within 48 hours.
  { advanceId: 'SMP-ADV-05', employee: 'SAMPLE Staff Four', employeeId: 'S004', issuedAt: utc(to, 4), amount: 90_000, retiredAmount: 90_000, refundedAmount: 0, retiredAt: utc(to, 3), purpose: 'SAMPLE: courier' },
];
