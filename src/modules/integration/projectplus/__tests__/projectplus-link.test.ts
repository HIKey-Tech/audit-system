import { prisma } from '../../../../shared/prisma/prisma.client';
import { ProjectPlusLinkService } from '../service/implementation/projectplus-link.service';
import { normalizeProjectPlusEntity } from '../utility/projectplus.utility';

jest.mock('../../../../shared/prisma/prisma.client', () => ({
  prisma: { projectplus_Entity_Link: { upsert: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() } },
}));
jest.mock('../../../logging/service/implementation/audit-log.service', () => ({ auditLogService: { logAsync: jest.fn() } }));

const actor = (permissions: string[]) => ({ id: 'u1', permissions } as never);
const client = {
  enabled: true,
  configured: true,
  listEntities: jest.fn().mockResolvedValue([normalizeProjectPlusEntity({ referenceCode: 'C-1', fullName: 'Acme', password: 'x' })]),
  getContractDocumentTypes: jest.fn(),
  checkStatus: jest.fn(),
};
const link = { id: 'l1', engagement_id: 'e1', customer_type: 'vendor', reference_code: 'C-1', full_name: 'Acme', created_at: new Date(), updated_at: new Date(), is_active: true };
const db = prisma as unknown as { projectplus_Entity_Link: Record<string, jest.Mock> };

describe('ProjectPlusLinkService', () => {
  const service = new ProjectPlusLinkService(client);
  beforeEach(() => jest.clearAllMocks());

  it('requires projectplus:link', async () => {
    await expect(service.linkEntity('e1', { customerType: 'vendor', referenceCode: 'C-1' }, actor(['projectplus:read'])))
      .rejects.toThrow('projectplus:link');
    expect(db.projectplus_Entity_Link.upsert).not.toHaveBeenCalled();
  });

  it('links an entity found upstream and stores only the identity summary', async () => {
    db.projectplus_Entity_Link.upsert.mockResolvedValue(link);
    client.listEntities.mockResolvedValue([normalizeProjectPlusEntity({ referenceCode: 'C-1', fullName: 'Acme', password: 'x' })]);
    const out = await service.linkEntity('e1', { customerType: 'vendor', referenceCode: 'c-1' }, actor(['projectplus:link']));
    expect(out.referenceCode).toBe('C-1');
    expect(JSON.stringify(db.projectplus_Entity_Link.upsert.mock.calls[0][0])).not.toContain('"password"');
  });

  it('404s when the entity does not exist upstream', async () => {
    client.listEntities.mockResolvedValue([]);
    await expect(service.linkEntity('e1', { customerType: 'vendor', referenceCode: 'nope' }, actor(['projectplus:link'])))
      .rejects.toThrow('not found');
  });

  it('unlink soft-deletes', async () => {
    db.projectplus_Entity_Link.findFirst.mockResolvedValue(link);
    await service.unlinkEntity('l1', actor(['projectplus:link']));
    expect(db.projectplus_Entity_Link.update.mock.calls[0][0].data.is_active).toBe(false);
  });
});
