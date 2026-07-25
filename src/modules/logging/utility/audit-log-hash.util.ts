// Pure, deterministic hash-chain logic for the audit trail. Kept free of I/O so
// it is unit-testable and the seal is reproducible from a row's own fields.
//
// Each sealed row stores row_hash = SHA256(prev_hash + its immutable fields).
// Because every row commits the previous row's hash, editing or deleting any
// historical row breaks the chain from that point on — which verifyLogChain
// detects and localizes.
import { createHash } from 'crypto';

/** The immutable fields of an audit-log row that the seal covers. */
export interface SealableLogFields {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: string | null;
  new_values: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  error_message: string | null;
  duration_ms: number | null;
  created_at: Date | string;
}

export type SealedLogRow = SealableLogFields & {
  prev_hash: string | null;
  row_hash: string | null;
};

export interface ChainVerificationResult {
  ok: boolean;
  sealedCount: number;
  verifiedCount: number;
  brokenAtId?: string;
  reason?: string;
}

const isoOf = (value: Date | string): string =>
  typeof value === 'string' ? value : value.toISOString();

// Positional array (not an object) so serialization is order-stable and never
// depends on key ordering.
const canonical = (f: SealableLogFields, prevHash: string | null): string =>
  JSON.stringify([
    prevHash,
    f.id,
    f.user_id,
    f.action,
    f.module,
    f.entity_type,
    f.entity_id,
    f.old_values,
    f.new_values,
    f.ip_address,
    f.user_agent,
    f.status,
    f.error_message,
    f.duration_ms,
    isoOf(f.created_at),
  ]);

/** SHA-256 hex seal for one row, committing the previous row's hash. */
export const computeRowHash = (fields: SealableLogFields, prevHash: string | null): string =>
  createHash('sha256').update(canonical(fields, prevHash)).digest('hex');

/**
 * Verify a set of sealed rows by following prev_hash links (order-independent —
 * does not rely on created_at). Reports the first anomaly:
 *  - a row whose recomputed hash differs (row was altered),
 *  - multiple/zero chain starts or a fork (a row was deleted, or two chains exist),
 *  - orphaned rows not reachable from the start (deletion mid-chain).
 * An empty sealed set is trivially valid.
 */
type SealedRow = SealableLogFields & { prev_hash: string | null; row_hash: string };

export const verifyLogChain = (rows: SealedLogRow[]): ChainVerificationResult => {
  const sealed = rows.filter(
    (r): r is SealedRow => typeof r.row_hash === 'string' && r.row_hash.length > 0,
  );
  if (sealed.length === 0) return { ok: true, sealedCount: 0, verifiedCount: 0 };

  const byHash = new Map<string, SealedRow>();
  const byPrev = new Map<string | null, SealedRow[]>();
  for (const r of sealed) byHash.set(r.row_hash, r);
  for (const r of sealed) {
    const list = byPrev.get(r.prev_hash) ?? [];
    list.push(r);
    byPrev.set(r.prev_hash, list);
  }

  // The chain start is a row whose prev_hash is null or points outside the sealed
  // set (the legacy boundary). Exactly one is expected.
  const starts = sealed.filter((r) => r.prev_hash === null || !byHash.has(r.prev_hash));
  if (starts.length !== 1) {
    return {
      ok: false,
      sealedCount: sealed.length,
      verifiedCount: 0,
      reason:
        starts.length === 0
          ? 'No chain start found (cycle or corrupted links)'
          : `Multiple chain starts (${starts.length}) — a row was deleted or the chain forked`,
    };
  }

  let current: SealedRow | undefined = starts[0];
  const seen = new Set<string>();
  let verified = 0;
  while (current) {
    if (seen.has(current.row_hash)) {
      return { ok: false, sealedCount: sealed.length, verifiedCount: verified, brokenAtId: current.id, reason: 'Cycle detected' };
    }
    seen.add(current.row_hash);

    if (computeRowHash(current, current.prev_hash) !== current.row_hash) {
      return { ok: false, sealedCount: sealed.length, verifiedCount: verified, brokenAtId: current.id, reason: 'Row hash mismatch — this row was altered' };
    }
    verified += 1;

    const nexts: SealedRow[] = byPrev.get(current.row_hash) ?? [];
    if (nexts.length > 1) {
      return { ok: false, sealedCount: sealed.length, verifiedCount: verified, brokenAtId: current.id, reason: 'Fork — multiple rows chain from this one' };
    }
    current = nexts[0];
  }

  if (verified !== sealed.length) {
    return {
      ok: false,
      sealedCount: sealed.length,
      verifiedCount: verified,
      reason: 'Orphaned rows not connected to the chain — a row was likely deleted',
    };
  }
  return { ok: true, sealedCount: sealed.length, verifiedCount: verified };
};
