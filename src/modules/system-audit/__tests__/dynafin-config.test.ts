import { prisma } from '../../../shared/prisma/prisma.client';
import { auditLogService } from '../../logging/service/implementation/audit-log.service';
import { SystemConfigService } from '../../settings/service/implementation/system-config.service';
import {
  DYNAFIN_CONFIG_KEYS,
  ensureDynafinConfigDefaults,
  parseThreshold,
} from '../utility/dynafin-config.utility';

jest.mock('../../../shared/prisma/prisma.client', () => ({
  prisma: {
    system_Config: { upsert: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('../../logging/service/implementation/audit-log.service', () => ({
  auditLogService: { logAsync: jest.fn(), log: jest.fn() },
}));

const db = prisma as unknown as { system_Config: Record<string, jest.Mock>; $transaction: jest.Mock };
const audit = auditLogService.logAsync as jest.Mock;

const row = (key: string, value: string | null) => ({
  id: `id-${key}`, key, value, description: null, is_public: false, updated_by_id: null, created_at: new Date(), updated_at: new Date(),
});

beforeEach(() => jest.clearAllMocks());

describe('parseThreshold', () => {
  it.each([['5000000', 5_000_000], ['5,000,000', 5_000_000], ['₦10,000,000', 10_000_000], [' 250 ', 250], ['0.5', 0.5]])('reads %p', (input, expected) => {
    expect(parseThreshold(input)).toBe(expected);
  });
  // Blank and zero must be refused: a ₦0 threshold would flag every transaction.
  it.each(['', '   ', '0', '0.00', 'abc', '-5', null, undefined, 'Infinity', '0x10', '1e7'])('rejects %p', (input) => {
    expect(parseThreshold(input as string)).toBeNull();
  });
});

describe('ensureDynafinConfigDefaults', () => {
  it('creates the two threshold rows with the spec defaults', async () => {
    await ensureDynafinConfigDefaults();
    const created = db.system_Config.upsert.mock.calls.map(([arg]) => [arg.where.key, arg.create.value]);
    expect(created).toEqual([
      [DYNAFIN_CONFIG_KEYS.highValue, '5000000'],
      [DYNAFIN_CONFIG_KEYS.highValueExpenditure, '10000000'],
    ]);
  });

  it('never overwrites a value an administrator has set (create-only)', async () => {
    await ensureDynafinConfigDefaults();
    for (const [arg] of db.system_Config.upsert.mock.calls) expect(arg.update).toEqual({});
  });

  it('never throws — a config problem must not stop the application starting', async () => {
    db.system_Config.upsert.mockRejectedValue(new Error('database unavailable'));
    await expect(ensureDynafinConfigDefaults()).resolves.toBeUndefined();
  });
});

describe('audit trail for threshold changes (spec §6.6)', () => {
  const service = new SystemConfigService();

  it('records who changed a Dynafin threshold, with the old and the new value', async () => {
    db.system_Config.findUnique.mockResolvedValue({ value: '5000000' });
    db.system_Config.update.mockResolvedValue(row(DYNAFIN_CONFIG_KEYS.highValue, '8000000'));
    await service.updateConfig(DYNAFIN_CONFIG_KEYS.highValue, '8000000', 'user-1');
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0][0]).toMatchObject({
      userId: 'user-1',
      action: 'settings.config.update',
      entityType: 'system_config',
      entityId: DYNAFIN_CONFIG_KEYS.highValue,
      oldValues: { value: '5000000' },
      newValues: { value: '8000000' },
    });
  });

  it('writes nothing extra when the value did not actually change', async () => {
    db.system_Config.findUnique.mockResolvedValue({ value: '5000000' });
    db.system_Config.update.mockResolvedValue(row(DYNAFIN_CONFIG_KEYS.highValue, '5000000'));
    await service.updateConfig(DYNAFIN_CONFIG_KEYS.highValue, '5000000', 'user-1');
    expect(audit).not.toHaveBeenCalled();
  });

  it('leaves every other setting exactly as it was — no new audit rows for them', async () => {
    db.system_Config.findUnique.mockResolvedValue({ value: 'old' });
    db.system_Config.update.mockResolvedValue(row('approval_matrix', 'new'));
    await service.updateConfig('approval_matrix', 'new', 'user-1');
    expect(audit).not.toHaveBeenCalled();
  });

  it('still reports an unknown key as not found, and changes nothing', async () => {
    db.system_Config.findUnique.mockResolvedValue(null);
    await expect(service.updateConfig('dynafin.nope', '1', 'user-1')).rejects.toMatchObject({ message: expect.stringContaining('not found') });
    expect(db.system_Config.update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('a bulk update records each changed Dynafin key (and only those)', async () => {
    db.system_Config.findMany
      .mockResolvedValueOnce([
        { key: DYNAFIN_CONFIG_KEYS.highValue, value: '5000000' },
        { key: DYNAFIN_CONFIG_KEYS.highValueExpenditure, value: '10000000' },
        { key: 'approval_matrix', value: 'a' },
      ])
      .mockResolvedValueOnce([]);
    db.$transaction.mockResolvedValue([]);
    await service.bulkUpdateConfig(
      {
        configs: [
          { key: DYNAFIN_CONFIG_KEYS.highValue, value: '6000000' },
          { key: DYNAFIN_CONFIG_KEYS.highValueExpenditure, value: '10000000' }, // unchanged
          { key: 'approval_matrix', value: 'b' }, // not a Dynafin key
        ],
      } as never,
      'user-2',
    );
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0][0]).toMatchObject({ entityId: DYNAFIN_CONFIG_KEYS.highValue, oldValues: { value: '5000000' }, newValues: { value: '6000000' } });
  });
});
