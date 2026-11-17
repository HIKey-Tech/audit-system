// Dynafin normalisers and error classification.
//
// THIS IS THE ONE PLACE that adapts Dynafin's real response format to IAMS's contract.
// When the API is released, adjust the alias lists below (or the mapping) and nothing
// else downstream changes. Every normaliser is an allow-list: a field not named here
// is dropped, never passed through. A record that lacks its essentials is dropped and
// counted, not guessed at.
import { AppError } from '../../../../shared/errors/app.error';
import {
  DYNAFIN_DEFAULT_CURRENCY,
  DynafinStaffAdvance,
  DynafinTransaction,
} from '../domain/entity/dynafin.entity';

type Raw = Record<string, unknown>;

const asRecord = (raw: unknown): Raw => (raw && typeof raw === 'object' ? (raw as Raw) : {});

/** First present value among a set of aliases (case- and separator-insensitive). */
const pick = (r: Raw, aliases: readonly string[]): unknown => {
  const normalised = new Map<string, unknown>();
  for (const [k, v] of Object.entries(r)) normalised.set(k.toLowerCase().replace(/[^a-z0-9]/g, ''), v);
  for (const alias of aliases) {
    const v = normalised.get(alias.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
};

const str = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

// Only two unambiguous layouts are accepted: plain digits ("5000000", "5000000.50") and
// comma-grouped thousands with a dot decimal ("5,000,000.50"). Anything else — a comma as
// the decimal mark ("1 234,50"), spaces inside the number, stray text — is refused, because
// guessing wrongly would misread a figure by 100× and silently move it across a threshold.
const PLAIN_AMOUNT = /^\d+(\.\d+)?$/;
const GROUPED_AMOUNT = /^\d{1,3}(,\d{3})+(\.\d+)?$/;

/**
 * Parses money written the way finance exports write it: 5000000, "5,000,000.00",
 * "₦5,000,000", "NGN 5,000,000", "(5,000.00)" (an accounting negative).
 * Returns the absolute value; null when the text is not an unambiguous number.
 */
export const parseMoney = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.abs(value) : null;
  if (typeof value !== 'string') return null;
  const body = value
    .trim()
    .replace(/^\((.*)\)$/, '$1') // accounting negative → sign is irrelevant, we keep the absolute value
    .replace(/^-/, '')
    .replace(/^(₦|NGN|N)\s*/i, '')
    .trim();
  if (!PLAIN_AMOUNT.test(body) && !GROUPED_AMOUNT.test(body)) return null;
  const n = Number(body.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** Valid date input → ISO string; anything else → null. */
export const parseIsoDate = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const truthy = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  return /^(true|yes|y|1|reversed|reversal)$/i.test(String(value ?? '').trim());
};

/** Unwraps `[...]` or `{ items | data | results | records: [...] }`. */
export const unwrapList = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  const r = asRecord(payload);
  for (const key of ['items', 'data', 'results', 'records', 'value']) {
    if (Array.isArray(r[key])) return r[key] as unknown[];
  }
  return [];
};

/** Null when the record lacks a reference, a readable date or a readable amount. */
export const normalizeDynafinTransaction = (raw: unknown): DynafinTransaction | null => {
  const r = asRecord(raw);
  const reference = str(pick(r, ['reference', 'ref', 'journalNumber', 'journalNo', 'voucherNumber', 'voucherNo', 'postingReference', 'transactionId', 'id']));
  const postingDate = parseIsoDate(pick(r, ['postingDate', 'date', 'transactionDate', 'postedAt', 'postedDate', 'valueDate']));
  const amount = parseMoney(pick(r, ['amount', 'value', 'transactionAmount', 'netAmount', 'debit', 'total']));
  if (!reference || !postingDate || amount === null) return null;
  return {
    reference,
    postingDate,
    amount,
    currency: str(pick(r, ['currency', 'currencyCode']))?.toUpperCase() ?? DYNAFIN_DEFAULT_CURRENCY,
    accountCode: str(pick(r, ['accountCode', 'account', 'glCode', 'ledgerCode', 'accountNumber'])),
    accountName: str(pick(r, ['accountName', 'accountDescription', 'glName', 'ledgerName'])),
    expenseCategory: str(pick(r, ['expenseCategory', 'category', 'expenditureCategory', 'expenseType', 'nature'])),
    description: str(pick(r, ['description', 'narration', 'narrative', 'remarks', 'details'])),
    payee: str(pick(r, ['payee', 'vendor', 'vendorName', 'supplier', 'supplierName', 'beneficiary'])),
    department: str(pick(r, ['department', 'costCentre', 'costCenter', 'costCentreName', 'unit'])),
    postedBy: str(pick(r, ['postedBy', 'postingUser', 'createdBy', 'enteredBy', 'user'])),
    approvedBy: str(pick(r, ['approvedBy', 'approver', 'authorisedBy', 'authorizedBy'])),
    supportingRef: str(pick(r, ['supportingRef', 'supportingReference', 'poNumber', 'purchaseOrder', 'documentReference', 'supportingDocument'])),
    invoiceNumber: str(pick(r, ['invoiceNumber', 'invoiceNo', 'invoice', 'invoiceRef'])),
    isReversal: truthy(pick(r, ['isReversal', 'reversal', 'reversed'])),
  };
};

/** Null when the record lacks an id, employee, issue date or readable amount. */
export const normalizeDynafinStaffAdvance = (raw: unknown): DynafinStaffAdvance | null => {
  const r = asRecord(raw);
  const advanceId = str(pick(r, ['advanceId', 'advanceNumber', 'advanceNo', 'reference', 'id']));
  const employee = str(pick(r, ['employee', 'employeeName', 'staffName', 'staff', 'name']));
  const issuedAt = parseIsoDate(pick(r, ['issuedAt', 'issueDate', 'dateIssued', 'advanceDate', 'date']));
  const amount = parseMoney(pick(r, ['amount', 'advanceAmount', 'value']));
  if (!advanceId || !employee || !issuedAt || amount === null) return null;
  return {
    advanceId,
    employee,
    employeeId: str(pick(r, ['employeeId', 'staffId', 'employeeNumber', 'staffNumber'])),
    issuedAt,
    amount,
    retiredAmount: parseMoney(pick(r, ['retiredAmount', 'amountRetired', 'retired'])) ?? 0,
    refundedAmount: parseMoney(pick(r, ['refundedAmount', 'amountRefunded', 'refunded'])) ?? 0,
    retiredAt: parseIsoDate(pick(r, ['retiredAt', 'retirementDate', 'dateRetired', 'lastRetirementDate'])),
    purpose: str(pick(r, ['purpose', 'description', 'narration', 'reason'])),
  };
};

/** Maps transport failures to safe, actionable errors. Never includes bodies or headers. */
export const classifyDynafinNetworkError = (err: unknown): AppError => {
  if (err instanceof AppError) return err;
  const e = err as { name?: string; message?: string; code?: string; cause?: { code?: string; message?: string; name?: string } } | undefined;
  const code = e?.cause?.code || e?.code || '';
  const message = (e?.cause?.message || e?.message || '').toLowerCase();
  const name = e?.cause?.name || e?.name || '';

  if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ECONNRESET', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET'].includes(code)) {
    return AppError.serviceUnavailable('Dynafin is unreachable from IAMS.');
  }
  if (
    code === 'SELF_SIGNED_CERT_IN_CHAIN' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || code.startsWith('CERT_') || code.startsWith('ERR_TLS_') ||
    message.includes('certificate') || message.includes('self signed')
  ) {
    return AppError.serviceUnavailable(
      "Dynafin's TLS certificate is not trusted by IAMS. Contact the administrator (CA not installed).",
    );
  }
  if (name === 'AbortError' || code === 'UND_ERR_HEADERS_TIMEOUT' || code === 'UND_ERR_BODY_TIMEOUT' || message.includes('aborted')) {
    return AppError.gatewayTimeout('Dynafin did not respond before the configured timeout.');
  }
  return AppError.serviceUnavailable('Unable to reach Dynafin.');
};

/** Maps non-2xx HTTP responses to safe errors. */
export const classifyDynafinHttpStatus = (status: number): AppError => {
  if (status === 401 || status === 403) return AppError.badGateway('Dynafin rejected the integration credentials.');
  if (status === 404) return AppError.notFound('Dynafin resource');
  if (status === 400 || status === 422) return AppError.badRequest('Dynafin rejected the request parameters.');
  if (status === 429) return AppError.tooManyRequests('Dynafin rate limit reached. Try again shortly.');
  return AppError.badGateway(`Dynafin reported an error (HTTP ${status}).`);
};
