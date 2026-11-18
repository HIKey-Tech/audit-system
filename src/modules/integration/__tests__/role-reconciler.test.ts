import { reconcileAdRoles, withBaselineRole } from '../utility/role-reconciler.utility';

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

describe('withBaselineRole', () => {
  it('gives the baseline role to someone who would otherwise have no role', () => {
    expect(withBaselineRole([], [], 'viewer')).toEqual(['viewer']);
  });

  it('adds nothing on top of a role mapped from a directory group', () => {
    expect(withBaselineRole(['system_auditor'], [], 'viewer')).toEqual(['system_auditor']);
  });

  it('adds nothing when an administrator has assigned the person a role', () => {
    expect(withBaselineRole([], [{ roleId: 'system_auditor', source: 'manual' }], 'viewer')).toEqual([]);
  });

  it('still counts a manually assigned role alongside an old directory-added viewer', () => {
    const current = [
      { roleId: 'system_auditor', source: 'manual' },
      { roleId: 'viewer', source: 'azure_ad' },
    ];
    const desired = withBaselineRole([], current, 'viewer');
    expect(desired).toEqual([]);
    // ...so the reconcile step removes the redundant viewer and leaves the real role alone.
    expect(reconcileAdRoles(current, desired)).toEqual({ toAdd: [], toRemove: ['viewer'] });
  });

  it('keeps a person whose only role is the baseline from losing it', () => {
    const current = [{ roleId: 'viewer', source: 'azure_ad' }];
    const desired = withBaselineRole([], current, 'viewer');
    expect(reconcileAdRoles(current, desired)).toEqual({ toAdd: [], toRemove: [] });
  });

  it('does nothing when no baseline role is configured', () => {
    expect(withBaselineRole([], [], null)).toEqual([]);
  });
});
