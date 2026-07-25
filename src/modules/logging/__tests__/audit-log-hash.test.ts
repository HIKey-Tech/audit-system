import { computeRowHash, verifyLogChain, SealableLogFields, SealedLogRow } from '../utility/audit-log-hash.util';

const baseFields = (id: string, action: string): SealableLogFields => ({
  id,
  user_id: null,
  action,
  module: 'audit',
  entity_type: null,
  entity_id: null,
  old_values: null,
  new_values: null,
  ip_address: null,
  user_agent: null,
  status: 'success',
  error_message: null,
  duration_ms: null,
  created_at: new Date('2026-07-25T00:00:00.000Z'),
});

const seal = (id: string, action: string, prevHash: string | null): SealedLogRow => {
  const fields = baseFields(id, action);
  return { ...fields, prev_hash: prevHash, row_hash: computeRowHash(fields, prevHash) };
};

const buildChain = (): SealedLogRow[] => {
  const r1 = seal('1', 'a', null);
  const r2 = seal('2', 'b', r1.row_hash);
  const r3 = seal('3', 'c', r2.row_hash);
  return [r1, r2, r3];
};

describe('audit-log hash chain', () => {
  it('computeRowHash is deterministic and prev-hash sensitive', () => {
    const f = baseFields('1', 'a');
    expect(computeRowHash(f, null)).toBe(computeRowHash(f, null));
    expect(computeRowHash(f, null)).not.toBe(computeRowHash(f, 'different-prev'));
  });

  it('verifies an intact chain regardless of row order', () => {
    const chain = buildChain();
    expect(verifyLogChain(chain)).toMatchObject({ ok: true, sealedCount: 3, verifiedCount: 3 });
    // Order-independent: verification follows prev_hash links, not created_at.
    expect(verifyLogChain([chain[2], chain[0], chain[1]]).ok).toBe(true);
  });

  it('treats an empty (or fully unsealed) set as valid', () => {
    expect(verifyLogChain([]).ok).toBe(true);
    const unsealed = { ...baseFields('x', 'a'), prev_hash: null, row_hash: null };
    expect(verifyLogChain([unsealed]).ok).toBe(true);
  });

  it('detects an altered row (row_hash no longer matches its fields)', () => {
    const chain = buildChain();
    // Someone edits the action but leaves the stored row_hash untouched.
    chain[1] = { ...chain[1], action: 'tampered' };
    const result = verifyLogChain(chain);
    expect(result.ok).toBe(false);
    expect(result.brokenAtId).toBe('2');
    expect(result.reason).toMatch(/altered/i);
  });

  it('detects a deleted middle row (chain no longer connects)', () => {
    const chain = buildChain();
    const withoutMiddle = [chain[0], chain[2]]; // r2 deleted
    const result = verifyLogChain(withoutMiddle);
    expect(result.ok).toBe(false);
  });
});
