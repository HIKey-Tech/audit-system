import { assertNotPriorSigner, assertNotSelfApproval } from '../utility/workflow.utility';

describe('segregation of duties — self-approval guard', () => {
  it('blocks the submitter from approving their own item', () => {
    expect(() => assertNotSelfApproval('user-1', 'user-1')).toThrow('segregation of duties');
  });

  it('allows a different authorized user to approve', () => {
    expect(() => assertNotSelfApproval('user-1', 'user-2')).not.toThrow();
  });
});

describe('segregation of duties — one signer per approval chain', () => {
  // A three-level report chain: manager → oversight → final.
  const chain = (overrides: Array<Partial<{ status: string; approver_id: string | null }>>) =>
    overrides.map((o, i) => ({ level: i + 1, status: 'pending', approver_id: null, ...o }));

  it('blocks someone who already signed level 1 from signing level 2', () => {
    const steps = chain([{ status: 'approved', approver_id: 'cae' }, {}, {}]);
    expect(() => assertNotPriorSigner(steps, 2, 'cae')).toThrow('segregation of duties');
  });

  it('blocks a sole super admin carrying an item through every level', () => {
    const steps = chain([
      { status: 'approved', approver_id: 'root' },
      { status: 'approved', approver_id: 'root' },
      {},
    ]);
    expect(() => assertNotPriorSigner(steps, 3, 'root')).toThrow('segregation of duties');
  });

  it('allows a different user to sign the next level', () => {
    const steps = chain([{ status: 'approved', approver_id: 'manager' }, {}, {}]);
    expect(() => assertNotPriorSigner(steps, 2, 'cae')).not.toThrow();
  });

  it('lets the first signer act on level 1 (no earlier levels to conflict with)', () => {
    expect(() => assertNotPriorSigner(chain([{}, {}, {}]), 1, 'manager')).not.toThrow();
  });

  it('ignores a pinned-but-unsigned earlier step (only actual signatures count)', () => {
    // approver_id is set on a pending pinned step, but nobody has signed it yet.
    const steps = chain([{ status: 'pending', approver_id: 'cae' }, {}]);
    expect(() => assertNotPriorSigner(steps, 2, 'cae')).not.toThrow();
  });

  it('ignores a rejected earlier step', () => {
    const steps = chain([{ status: 'rejected', approver_id: 'cae' }, {}]);
    expect(() => assertNotPriorSigner(steps, 2, 'cae')).not.toThrow();
  });

  it('only looks at EARLIER levels, not later ones', () => {
    const steps = chain([{}, {}, { status: 'approved', approver_id: 'cae' }]);
    expect(() => assertNotPriorSigner(steps, 2, 'cae')).not.toThrow();
  });
});
