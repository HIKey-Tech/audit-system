jest.mock('../../../../shared/prisma/prisma.client', () => ({ prisma: { user: { findMany: jest.fn() } } }));
jest.mock('../../../messaging/service/implementation/notification-queue.service', () => ({
  notificationQueueService: { enqueueSafe: jest.fn() },
}));
jest.mock('../../../logging/service/implementation/audit-log.service', () => ({ auditLogService: { logAsync: jest.fn() } }));

import { prisma } from '../../../../shared/prisma/prisma.client';
import { notificationQueueService } from '../../../messaging/service/implementation/notification-queue.service';
import { UniverseService } from '../service/implementation/universe.service';

const findMany = prisma.user.findMany as jest.Mock;
const enqueue = notificationQueueService.enqueueSafe as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service: any = new (UniverseService as any)({});
const person = (id: string, name: string) => ({ id, email: `${id}@gbb.test`, display_name: name, first_name: name, last_name: '' });

beforeEach(() => jest.clearAllMocks());

describe('staff in charge of a universe entity', () => {
  it('each person put in charge gets an in-app notice and an email naming the entity', async () => {
    findMany.mockResolvedValue([person('u1', 'Ada'), person('u2', 'Bola')]);
    await service._notifyStaffInCharge('e1', 'Treasury Unit', ['u1', 'u2'], 'creator');
    const emails = enqueue.mock.calls.filter((c) => c[0] === 'email').map((c) => c[1]);
    expect(emails.map((e) => e.to)).toEqual(['u1@gbb.test', 'u2@gbb.test']);
    expect(emails[0].subject).toContain('Treasury Unit');
    expect(enqueue.mock.calls.filter((c) => c[0] === 'in_app')).toHaveLength(2);
  });

  it('never tells the person who just did it', async () => {
    findMany.mockResolvedValue([]);
    await service._notifyStaffInCharge('e1', 'X', ['creator'], 'creator');
    expect(findMany).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('a notification problem never fails saving the entity', async () => {
    findMany.mockRejectedValue(new Error('db down'));
    await expect(service._notifyStaffInCharge('e1', 'X', ['u1'], 'creator')).resolves.toBeUndefined();
  });
});
