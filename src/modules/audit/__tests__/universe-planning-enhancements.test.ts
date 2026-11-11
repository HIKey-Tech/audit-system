import { Prisma } from '@prisma/client';
import { AuditFrequency, AuditPriority, UniverseCategory, UniverseStatus } from '../domain/enum/audit.enum';
import {
  CreateUniverseRequestSchema,
  UniverseQuerySchema,
  UpdateUniverseRequestSchema,
} from '../universe/dto/request/universe.request.dto';
import { mapUniverseToResponse } from '../universe/dto/response/universe.response.dto';
import { listUniverseReferenceBlockers, resolveUniverseOwners } from '../universe/utility/universe.utility';
import {
  AddPlanItemRequestSchema,
  BulkAddPlanItemsRequestSchema,
  UpdatePlanItemRequestSchema,
  UpdatePlanRequestSchema,
} from '../planning/dto/request/planning.request.dto';
import {
  classifyUniverseDueStatus,
  computeEntityRecommendation,
  recommendedPriorityFromRiskScore,
} from '../planning/utility/planning.utility';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333333';

describe('universe multi-owner & on-demand enhancements', () => {
  describe('resolveUniverseOwners', () => {
    it('resolves unified ownerIds into primary + co-owners while deduplicating', () => {
      const resolved = resolveUniverseOwners({ ownerIds: [U1, U2, U1, U3] });
      expect(resolved).toEqual({
        primaryOwnerId: U1,
        additionalOwnerIds: [U2, U3],
      });
    });

    it('supports legacy ownerId + additionalOwnerIds and strips primary from additional', () => {
      const resolved = resolveUniverseOwners({
        ownerId: U1,
        additionalOwnerIds: [U1, U2, U3, U2],
      });
      expect(resolved).toEqual({
        primaryOwnerId: U1,
        additionalOwnerIds: [U2, U3],
      });
    });

    it('preserves existing additional owners when only ownerId changes, removing new primary from additional', () => {
      const resolved = resolveUniverseOwners(
        { ownerId: U2 },
        { primaryOwnerId: U1, additionalOwnerIds: [U2, U3] },
      );
      expect(resolved).toEqual({
        primaryOwnerId: U2,
        additionalOwnerIds: [U3],
      });
    });

    it('returns null when no owner inputs are supplied', () => {
      expect(resolveUniverseOwners({})).toBeNull();
    });
  });

  describe('Universe DTOs & response mapper', () => {
    it('accepts multiple owners via ownerIds and on_demand auditFrequency', () => {
      const parsed = CreateUniverseRequestSchema.safeParse({
        name: 'Core Treasury System',
        category: UniverseCategory.System,
        ownerIds: [U1, U2],
        auditFrequency: AuditFrequency.OnDemand,
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects create requests with neither ownerId nor ownerIds', () => {
      const parsed = CreateUniverseRequestSchema.safeParse({
        name: 'Unowned Process',
        category: UniverseCategory.Process,
        auditFrequency: AuditFrequency.Annual,
      });
      expect(parsed.success).toBe(false);
    });

    it('accepts search and auditFrequency filters in UniverseQuerySchema', () => {
      const parsed = UniverseQuerySchema.safeParse({
        search: 'Treasury',
        auditFrequency: 'on_demand',
        status: UniverseStatus.Active,
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.search).toBe('Treasury');
        expect(parsed.data.auditFrequency).toBe(AuditFrequency.OnDemand);
      }
    });

    it('accepts ownerIds updates on UpdateUniverseRequestSchema', () => {
      const parsed = UpdateUniverseRequestSchema.safeParse({
        ownerIds: [U2, U1],
        auditFrequency: AuditFrequency.OnDemand,
      });
      expect(parsed.success).toBe(true);
    });

    it('maps primary and additional owners into ownerIds and owners cleanly', () => {
      const dto = mapUniverseToResponse({
        id: 'ent-1',
        name: 'Treasury',
        description: null,
        category: UniverseCategory.Department,
        owner_id: U1,
        owner: { id: U1, display_name: 'Alice Primary', first_name: 'Alice', last_name: 'Primary' },
        additional_owners: [
          {
            user_id: U2,
            user: { id: U2, display_name: 'Bob CoOwner', first_name: 'Bob', last_name: 'CoOwner' },
          },
          // Duplicate of primary should be ignored defensively
          {
            user_id: U1,
            user: { id: U1, display_name: 'Alice Primary', first_name: 'Alice', last_name: 'Primary' },
          },
        ],
        risk_score: new Prisma.Decimal(16),
        last_audited_at: null,
        audit_frequency: AuditFrequency.OnDemand,
        status: UniverseStatus.Active,
        created_by_id: U1,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        updated_at: new Date('2026-01-02T00:00:00.000Z'),
      });

      expect(dto.ownerId).toBe(U1);
      expect(dto.ownerName).toBe('Alice Primary');
      expect(dto.ownerIds).toEqual([U1, U2]);
      expect(dto.owners).toEqual([
        { id: U1, name: 'Alice Primary', isPrimary: true },
        { id: U2, name: 'Bob CoOwner', isPrimary: false },
      ]);
      expect(dto.auditFrequency).toBe('on_demand');
    });
  });

  describe('listUniverseReferenceBlockers', () => {
    it('returns empty array when zero downstream references exist', () => {
      expect(
        listUniverseReferenceBlockers({
          planItems: 0,
          engagements: 0,
          risks: 0,
          assets: 0,
          systemDocs: 0,
        }),
      ).toEqual([]);
    });

    it('formats singular and plural blockers cleanly', () => {
      expect(
        listUniverseReferenceBlockers({
          planItems: 1,
          engagements: 2,
          risks: 0,
          assets: 1,
          systemDocs: 3,
        }),
      ).toEqual(['1 audit plan item', '2 engagements', '1 linked asset', '3 system documents']);
    });
  });
});

describe('planning utilities & DTO enhancements', () => {
  const weights = {
    riskScore: 40,
    openFindings: 25,
    overdueForAudit: 15,
    neverAudited: 10,
    timeSinceLastAudit: 10,
  };
  const now = new Date('2026-06-15T00:00:00.000Z');

  it('never penalizes on_demand entities as never-audited or overdue', () => {
    const rec = computeEntityRecommendation(
      {
        id: U1,
        name: 'Special Investigation Desk',
        category: 'process',
        riskScore: 15,
        auditFrequency: AuditFrequency.OnDemand,
        lastAuditedAt: null,
      },
      1,
      weights,
      now,
    );

    expect(rec.components.overdueForAudit).toBe(0);
    expect(rec.components.neverAudited).toBe(0);
    expect(rec.components.timeSinceLastAudit).toBe(0);
    expect(rec.reasons).not.toContain('Never audited');
    expect(rec.reasons.some((r) => r.includes('overdue'))).toBe(false);
    expect(rec.reasons).toContain('High risk score (15)');
    expect(rec.reasons).toContain('1 unresolved finding');
  });

  it('flags periodic entities without audit history as never_audited', () => {
    const rec = computeEntityRecommendation(
      {
        id: U2,
        name: 'Treasury Operations',
        category: 'department',
        riskScore: 20,
        auditFrequency: AuditFrequency.Annual,
        lastAuditedAt: null,
      },
      0,
      weights,
      now,
    );

    expect(rec.components.neverAudited).toBe(100);
    expect(rec.components.timeSinceLastAudit).toBe(100);
    expect(rec.reasons).toContain('Never audited');
  });

  it('classifies dueStatus across periodic vs on_demand entities', () => {
    expect(classifyUniverseDueStatus(AuditFrequency.OnDemand, null, 2026, now)).toBe('on_demand');
    expect(classifyUniverseDueStatus(AuditFrequency.Annual, null, 2026, now)).toBe('never_audited');
    expect(
      classifyUniverseDueStatus(AuditFrequency.Annual, new Date('2024-01-01T00:00:00.000Z'), 2026, now),
    ).toBe('overdue');
    expect(
      classifyUniverseDueStatus(AuditFrequency.Annual, new Date('2025-11-01T00:00:00.000Z'), 2026, now),
    ).toBe('due_in_year');
    expect(
      classifyUniverseDueStatus(AuditFrequency.Annual, new Date('2026-04-01T00:00:00.000Z'), 2026, now),
    ).toBe('on_track');
  });

  it('maps risk score bands to recommended audit priority', () => {
    expect(recommendedPriorityFromRiskScore(25)).toBe(AuditPriority.Critical);
    expect(recommendedPriorityFromRiskScore(20)).toBe(AuditPriority.Critical);
    expect(recommendedPriorityFromRiskScore(13)).toBe(AuditPriority.High);
    expect(recommendedPriorityFromRiskScore(6)).toBe(AuditPriority.Medium);
    expect(recommendedPriorityFromRiskScore(5)).toBe(AuditPriority.Low);
    expect(recommendedPriorityFromRiskScore(null)).toBe(AuditPriority.Low);
  });

  it('validates date ordering on AddPlanItemRequestSchema, UpdatePlanItemRequestSchema & BulkAddPlanItemsRequestSchema', () => {
    const badRange = AddPlanItemRequestSchema.safeParse({
      universeId: U1,
      priority: AuditPriority.High,
      plannedStartDate: '2026-06-01T00:00:00.000Z',
      plannedEndDate: '2026-05-01T00:00:00.000Z',
    });
    expect(badRange.success).toBe(false);

    const emptyUpdate = UpdatePlanItemRequestSchema.safeParse({});
    expect(emptyUpdate.success).toBe(false);

    const validUpdate = UpdatePlanItemRequestSchema.safeParse({
      priority: AuditPriority.Critical,
      notes: null,
    });
    expect(validUpdate.success).toBe(true);

    const validBulk = BulkAddPlanItemsRequestSchema.safeParse({
      items: [
        {
          universeId: U1,
          priority: AuditPriority.High,
          plannedStartDate: '2026-03-01T00:00:00.000Z',
          plannedEndDate: '2026-04-01T00:00:00.000Z',
        },
      ],
    });
    expect(validBulk.success).toBe(true);

    const nullableDescription = UpdatePlanRequestSchema.safeParse({ description: null });
    expect(nullableDescription.success).toBe(true);
  });
});

