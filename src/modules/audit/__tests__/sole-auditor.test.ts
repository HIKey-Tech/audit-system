import { isSoleAuditor } from '../utility/audit.utility';

describe('who counts as a sole auditor', () => {
  it('is the person who is both lead and manager', () => {
    expect(isSoleAuditor({ lead_auditor_id: 'ada', audit_manager_id: 'ada' }, 'ada')).toBe(true);
  });

  it('is nobody when the audit has a separate manager', () => {
    expect(isSoleAuditor({ lead_auditor_id: 'ada', audit_manager_id: 'bola' }, 'ada')).toBe(false);
    expect(isSoleAuditor({ lead_auditor_id: 'ada', audit_manager_id: 'bola' }, 'bola')).toBe(false);
  });

  it('is not someone else on a sole-auditor audit (a supporting auditor still gets their work approved)', () => {
    expect(isSoleAuditor({ lead_auditor_id: 'ada', audit_manager_id: 'ada' }, 'chidi')).toBe(false);
  });
});
