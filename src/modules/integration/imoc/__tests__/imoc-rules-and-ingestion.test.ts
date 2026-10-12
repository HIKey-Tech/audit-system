import {
  buildUpstreamQueries,
  countRuleCombinations,
  formatImocDate,
  formatImocDateRange,
  hashImocTicket,
  matchesRuleCriteria,
  parseImocDate,
  resolveTicketCategory,
  validateRuleCriteria,
} from '../utility/imoc.utility';
import { ImocTicket } from '../domain/entity/imoc.entity';
import { ImocIngestionService } from '../service/implementation/imoc-ingestion.service';
import { IImocClient } from '../service/client/imoc.client';
import { config } from '../../../../shared/config/app.config';

describe('IMOC Ingestion Rules & Engine', () => {
  describe('Rule Criteria Validation and Combinations', () => {
    it('accepts valid rule criteria within the combo cap', () => {
      const criteria = {
        orderStatus: ['processing', 'completed'] as const,
        slaStatus: ['BREAK'],
        modelIds: ['mod-1', 'mod-2'],
      };
      const validated = validateRuleCriteria(criteria);
      expect(validated.orderStatus).toEqual(['processing', 'completed']);
      expect(countRuleCombinations(validated)).toBe(4); // 2 * 1 * 2 = 4 <= 20
    });

    it('rejects unknown criteria keys (strict schema enforcement)', () => {
      const criteria = {
        orderStatus: ['processing'],
        unknownField: 'illegal',
      };
      expect(() => validateRuleCriteria(criteria)).toThrow();
    });

    it('rejects invalid enum values for orderStatus', () => {
      const criteria = {
        orderStatus: ['invalid_status'],
      };
      expect(() => validateRuleCriteria(criteria)).toThrow();
    });

    it('rejects criteria that exceed the 20-combination cap', () => {
      // 3 * 3 * 3 = 27 > 20
      const oversized = {
        orderStatus: ['processing', 'dismissed', 'completed'] as const,
        slaStatus: ['NORMAL', 'BREAK', 'TIMEOUT'],
        modelIds: ['m1', 'm2', 'm3'],
      };
      expect(() => validateRuleCriteria(oversized)).toThrow(
        /Rule criteria generates 27 query combinations \(maximum allowed is 20\)/,
      );
    });

    it('builds cartesian upstream queries with correct date bounds', () => {
      const criteria = {
        orderStatus: ['processing', 'completed'] as Array<'processing' | 'completed'>,
        slaStatus: ['BREAK'],
      };
      const testNow = new Date('2026-10-11T12:00:00Z');
      const queries = buildUpstreamQueries(criteria, 10, true, testNow);

      expect(queries).toHaveLength(2);
      expect(queries[0].orderStatus).toBe('processing');
      expect(queries[0].slaStatus).toBe('BREAK');
      expect(queries[0].beginEndDate).toBe('2026-10-11 12:00:00');
      expect(queries[0].beginStartDate).toBe('2026-10-01 12:00:00');

      expect(queries[1].orderStatus).toBe('completed');
      expect(queries[1].slaStatus).toBe('BREAK');
    });
  });

  describe('Date Parsing and Formatting', () => {
    it('formats dates in UTC', () => {
      const date = new Date('2026-07-22T14:30:00.000Z');
      expect(formatImocDate(date, true)).toBe('2026-07-22 14:30:00');
    });

    it('parses IMOC YYYY-MM-DD HH:mm:ss timestamps correctly into UTC Dates', () => {
      const parsed = parseImocDate('2026-07-22 14:30:00', true);
      expect(parsed).not.toBeNull();
      expect(parsed?.toISOString()).toBe('2026-07-22T14:30:00.000Z');
    });

    it('returns null for empty or invalid date strings', () => {
      expect(parseImocDate(null)).toBeNull();
      expect(parseImocDate('')).toBeNull();
      expect(parseImocDate('invalid-date')).toBeNull();
    });
  });

  describe('Pure Rule Matcher', () => {
    const sampleTicket: ImocTicket = {
      orderId: 't-1',
      orderNumber: 'INCT2607220012',
      orderName: 'Core Router Link Flap',
      modelId: 'mod-net',
      modelName: 'Network Incident',
      modelType: 'incident',
      orderStatus: 'processing',
      slaStatus: 'BREAK',
      currentStepId: 'step-1',
      currentStepName: 'Investigate',
      currentStepSequence: 2,
      currentUser: 'j.smith',
      currentHandlingGroup: 'NOC',
      applicant: 'admin',
      beginTime: '2026-10-10 10:00:00',
      endTime: null,
      processType: 'telecom',
      sourceTenant: 'GBB_INTERNAL',
      priority: 'HIGH',
      processingHistory: [],
      retrievedAt: '2026-10-11T12:00:00Z',
    };

    it('matches ticket when all defined criteria match', () => {
      const criteria = {
        orderStatus: ['processing'] as any,
        slaStatus: ['BREAK'],
        nameContains: 'Router',
      };
      expect(matchesRuleCriteria(sampleTicket, criteria)).toBe(true);
    });

    it('fails match when a criteria does not match', () => {
      const criteria = {
        orderStatus: ['completed'] as any,
      };
      expect(matchesRuleCriteria(sampleTicket, criteria)).toBe(false);
    });

    it('filters by lookback window (createdWithinDays)', () => {
      const now = new Date('2026-10-11T12:00:00Z');
      expect(matchesRuleCriteria(sampleTicket, { createdWithinDays: 2 }, now)).toBe(true);
      expect(matchesRuleCriteria(sampleTicket, { createdWithinDays: 0.5 }, now)).toBe(false);
    });
  });

  describe('Category Resolution and Change Hash', () => {
    const sampleTicket: ImocTicket = {
      orderId: 't-1',
      orderNumber: 'INCT2607220012',
      orderName: 'Core Switch Maintenance',
      modelId: 'mod-1',
      modelName: 'Change Request',
      modelType: 'change',
      orderStatus: 'processing',
      slaStatus: 'NORMAL',
      currentStepId: null,
      currentStepName: null,
      currentStepSequence: null,
      currentUser: 'engineer',
      currentHandlingGroup: null,
      applicant: null,
      beginTime: null,
      endTime: null,
      processType: null,
      sourceTenant: null,
      priority: null,
      processingHistory: [],
      retrievedAt: '2026-10-11T12:00:00Z',
    };

    it('resolves category from highest priority matched rule', () => {
      const matched = [
        { priority: 100, category: 'Low Priority Cat' },
        { priority: 10, category: 'Critical Infrastructure' },
      ];
      expect(resolveTicketCategory(matched, sampleTicket)).toBe('Critical Infrastructure');
    });

    it('falls back to modelType when rules have no category', () => {
      expect(resolveTicketCategory([], sampleTicket)).toBe('Change Management');
    });

    it('falls back to Uncategorised when modelType is unknown', () => {
      const unknownTicket = { ...sampleTicket, modelType: 'custom_type_xyz' };
      expect(resolveTicketCategory([], unknownTicket)).toBe('Uncategorised');
    });

    it('generates consistent source hash and detects field mutations', () => {
      const hash1 = hashImocTicket(sampleTicket);
      const hash2 = hashImocTicket(sampleTicket);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);

      const mutated = { ...sampleTicket, orderStatus: 'completed' };
      const hash3 = hashImocTicket(mutated);
      expect(hash3).not.toBe(hash1);
    });
  });

  describe('Ingestion Service Workflow and Idempotency', () => {
    it('handles idempotent runs: created count on run 1, skipped on run 2', async () => {
      const mockTickets: ImocTicket[] = [
        {
          orderId: 'imoc-101',
          orderNumber: 'INCT2607220012',
          orderName: 'Firewall Rule Update',
          modelId: 'mod-chg',
          modelName: 'Change',
          modelType: 'change',
          orderStatus: 'processing',
          slaStatus: 'BREAK',
          currentStepId: 'step-1',
          currentStepName: 'Review',
          currentStepSequence: 1,
          currentUser: 'secops',
          currentHandlingGroup: 'Security',
          applicant: 'requester',
          beginTime: '2026-10-10 10:00:00',
          endTime: null,
          processType: 'security',
          sourceTenant: 'GBB',
          priority: 'P1',
          processingHistory: [],
          retrievedAt: new Date().toISOString(),
        },
      ];

      const mockClient: IImocClient = {
        enabled: true,
        configured: true,
        checkStatus: jest.fn().mockResolvedValue({ reachable: true, authenticated: true, lastError: null, checkedAt: '' }),
        listTickets: jest.fn().mockResolvedValue({
          items: mockTickets,
          page: 1,
          pageSize: 100,
          total: 1,
          totalPages: 1,
          hasNext: false,
        }),
        getTicket: jest.fn(),
        getModel: jest.fn(),
        getTicketStatus: jest.fn(),
        getCurrentTicketStatus: jest.fn(),
        getLightweightTickets: jest.fn(),
        resolveTicket: jest.fn(),
      };

      const storedTicketsMap = new Map<string, any>();
      const runsList: any[] = [];
      const rulesList: any[] = [
        {
          id: 'rule-1',
          name: 'Breached SLA',
          priority: 10,
          criteria_json: JSON.stringify({ slaStatus: ['BREAK'] }),
          category: 'Security Operations',
          risk_category_id: null,
          lookback_days: 30,
          is_active: true,
          deleted_at: null,
        },
      ];

      const mockPrisma: any = {
        imoc_Ingestion_Run: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation(({ data }: any) => {
            const run = { id: `run-${runsList.length + 1}`, ...data };
            runsList.push(run);
            return Promise.resolve(run);
          }),
          update: jest.fn().mockImplementation(({ where, data }: any) => {
            const run = runsList.find((r) => r.id === where.id);
            if (run) Object.assign(run, data);
            return Promise.resolve(run);
          }),
        },
        imoc_Ingestion_Rule: {
          findMany: jest.fn().mockResolvedValue(rulesList),
          update: jest.fn().mockResolvedValue({}),
        },
        imoc_Ticket: {
          findUnique: jest.fn().mockImplementation(({ where }: any) => {
            return Promise.resolve(storedTicketsMap.get(where.order_id) || null);
          }),
          create: jest.fn().mockImplementation(({ data }: any) => {
            const ticket = { id: `st-${storedTicketsMap.size + 1}`, ...data };
            storedTicketsMap.set(data.order_id, ticket);
            return Promise.resolve(ticket);
          }),
          update: jest.fn().mockImplementation(({ where, data }: any) => {
            for (const [key, t] of storedTicketsMap.entries()) {
              if (t.id === where.id) {
                Object.assign(t, data);
                return Promise.resolve(t);
              }
            }
            return Promise.resolve(null);
          }),
        },
        imoc_Ticket_Link: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };

      // Enable IMOC in config for this test
      const originalEnabled = config.imoc.enabled;
      (config.imoc as any).enabled = true;

      const service = new ImocIngestionService(mockPrisma, mockClient);

      try {
        // Run 1: Should create ticket
        const run1 = await service.runIngestion('scheduled');
        expect(run1.status).toBe('success');
        expect(run1.created).toBe(1);
        expect(run1.updated).toBe(0);
        expect(run1.skipped).toBe(0);
        expect(storedTicketsMap.size).toBe(1);

        // Run 2: Same data, should be skipped (idempotent)
        const run2 = await service.runIngestion('scheduled');
        expect(run2.status).toBe('success');
        expect(run2.created).toBe(0);
        expect(run2.updated).toBe(0);
        expect(run2.skipped).toBe(1);
        expect(storedTicketsMap.size).toBe(1);
      } finally {
        (config.imoc as any).enabled = originalEnabled;
      }
    });
  });
});
