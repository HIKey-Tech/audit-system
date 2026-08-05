/**
 * Guards the System/IT domain merge: the merged `it` domain must carry the
 * former Systems controls and skill keywords, and records created before the
 * merge (audit_type = 'systems') must still resolve to the same behaviour.
 */

import { CONTROL_SETS } from '../utility/audit.utility';
import { AuditType } from '../domain/enum/audit.enum';
import { isRelevantSkill, getMatchedSkills } from '../../workflow/assignment/utility/assignment-matching.util';

describe('System/IT audit domain merge', () => {
  it('gives the merged `it` domain every former Systems control', () => {
    const itRefs = CONTROL_SETS[AuditType.It].map((c) => c.controlReference);

    for (const control of CONTROL_SETS[AuditType.Systems]) {
      expect(itRefs).toContain(control.controlReference);
    }
  });

  it('does not duplicate any control reference within the merged domain', () => {
    const itRefs = CONTROL_SETS[AuditType.It].map((c) => c.controlReference);

    expect(new Set(itRefs).size).toBe(itRefs.length);
  });

  it('keeps the original IT controls alongside the merged ones', () => {
    const itRefs = CONTROL_SETS[AuditType.It].map((c) => c.controlReference);

    expect(itRefs).toContain('ISO27001-A.5.15'); // original IT
    expect(itRefs).toContain('SYS-INF-001'); // merged in from Systems
  });

  it('matches infrastructure and continuity skills against the merged domain', () => {
    for (const skill of ['Infrastructure', 'Disaster Recovery', 'Capacity Planning', 'CAB']) {
      expect(isRelevantSkill(skill, 'it')).toBe(true);
    }
    // The original IT keywords must survive the union.
    expect(isRelevantSkill('ISO 27001', 'it')).toBe(true);
  });

  it('treats the retired `systems` type as an alias of `it`', () => {
    const skills = ['Infrastructure', 'ISO 27001', 'Tax'];

    expect(getMatchedSkills(skills, 'systems')).toEqual(getMatchedSkills(skills, 'it'));
  });

  it('still rejects skills belonging to another domain', () => {
    expect(isRelevantSkill('Tax', 'it')).toBe(false);
  });
});
