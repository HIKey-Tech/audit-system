import { assertNotSelfApproval } from '../utility/workflow.utility';

describe('segregation of duties — self-approval guard', () => {
  it('blocks the submitter from approving their own item', () => {
    expect(() => assertNotSelfApproval('user-1', 'user-1')).toThrow('segregation of duties');
  });

  it('allows a different authorized user to approve', () => {
    expect(() => assertNotSelfApproval('user-1', 'user-2')).not.toThrow();
  });
});
