/**
 * An audit programme is scoped to a single audit type, and every plan under it
 * inherits that type. These guard the contract at the DTO and mapper level —
 * the two places a stray per-plan audit type could creep back in.
 */

import {
  AddPlanItemRequestSchema,
  CreatePlanRequestSchema,
  PlanQuerySchema,
} from '../planning/dto/request/planning.request.dto';
import { mapPlanToResponse } from '../planning/dto/response/planning.response.dto';
import { AuditType } from '../domain/enum/audit.enum';

const planRow = (auditType: string, itemCount: number) => ({
  id: 'plan-1',
  title: 'FY2026 System/IT Audit Programme',
  year: 2026,
  audit_type: auditType,
  description: null,
  status: 'approved',
  created_by_id: 'user-1',
  approved_by_id: null,
  approved_at: null,
  rejection_reason: null,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  items: Array.from({ length: itemCount }, (_, i) => ({
    id: `item-${i}`,
    plan_id: 'plan-1',
    universe_id: `universe-${i}`,
    planned_start_date: new Date('2026-02-01'),
    planned_end_date: new Date('2026-03-01'),
    priority: 'medium',
    notes: null,
    engagement_created: false,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  })),
});

describe('audit programme audit type', () => {
  it('requires an audit type when creating a programme', () => {
    const missing = CreatePlanRequestSchema.safeParse({ title: 'FY2026', year: 2026 });
    expect(missing.success).toBe(false);

    const valid = CreatePlanRequestSchema.safeParse({
      title: 'FY2026',
      year: 2026,
      auditType: AuditType.It,
    });
    expect(valid.success).toBe(true);
  });

  it('rejects the retired `systems` type on a new programme', () => {
    const result = CreatePlanRequestSchema.safeParse({
      title: 'FY2026',
      year: 2026,
      auditType: 'systems',
    });
    expect(result.success).toBe(false);
  });

  it('ignores any audit type sent when adding a plan — it is inherited', () => {
    const result = AddPlanItemRequestSchema.safeParse({
      universeId: '3f1e4c8a-1b2d-4e5f-8a9b-0c1d2e3f4a5b',
      auditType: 'financial',
      plannedStartDate: '2026-02-01T00:00:00.000Z',
      plannedEndDate: '2026-03-01T00:00:00.000Z',
      priority: 'medium',
    });

    expect(result.success).toBe(true);
    expect(result.success && 'auditType' in result.data).toBe(false);
  });

  it('stamps every plan in the response with the programme’s type', () => {
    const mapped = mapPlanToResponse(planRow(AuditType.It, 3));

    expect(mapped.auditType).toBe('it');
    expect(mapped.items).toHaveLength(3);
    for (const item of mapped.items ?? []) {
      expect(item.auditType).toBe('it');
    }
  });

  it('reports the plan count from the items it holds', () => {
    expect(mapPlanToResponse(planRow(AuditType.Financial, 2)).itemsCount).toBe(2);
  });

  it('accepts audit type and search as programme list filters', () => {
    const result = PlanQuerySchema.safeParse({ auditType: 'compliance', search: 'FY2026' });

    expect(result.success).toBe(true);
    expect(result.success && result.data.auditType).toBe('compliance');
    expect(result.success && result.data.search).toBe('FY2026');
  });
});
