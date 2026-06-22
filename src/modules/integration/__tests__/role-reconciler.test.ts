import { reconcileAdRoles } from '../utility/role-reconciler.utility';

describe('reconcileAdRoles', () => {
  it('adds a desired role the user does not have yet', () => {
    const r = reconcileAdRoles([], ['auditor']);
    expect(r.toAdd).toEqual(['auditor']);
    expect(r.toRemove).toEqual([]);
  });

  it('removes an azure_ad role no longer desired', () => {
    const r = reconcileAdRoles(
      [{ roleId: 'auditor', source: 'azure_ad' }],
      [],
    );
    expect(r.toAdd).toEqual([]);
    expect(r.toRemove).toEqual(['auditor']);
  });

  it('never touches a manual role even when undesired', () => {
    const r = reconcileAdRoles(
      [{ roleId: 'audit_lead', source: 'manual' }],
      [],
    );
    expect(r.toAdd).toEqual([]);
    expect(r.toRemove).toEqual([]);
  });

  it('does not re-add a desired role that already exists as manual', () => {
    const r = reconcileAdRoles(
      [{ roleId: 'auditor', source: 'manual' }],
      ['auditor'],
    );
    expect(r.toAdd).toEqual([]);
    expect(r.toRemove).toEqual([]);
  });

  it('handles mixed add/remove/keep in one pass', () => {
    const r = reconcileAdRoles(
      [
        { roleId: 'auditor', source: 'azure_ad' }, // keep
        { roleId: 'viewer', source: 'azure_ad' },  // remove
        { roleId: 'cae', source: 'manual' },       // untouched
      ],
      ['auditor', 'audit_lead'], // audit_lead is new
    );
    expect(r.toAdd.sort()).toEqual(['audit_lead']);
    expect(r.toRemove).toEqual(['viewer']);
  });
});
