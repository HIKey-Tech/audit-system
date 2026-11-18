jest.mock('../../../shared/prisma/prisma.client', () => ({
  prisma: {
    workspace_Document: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));

import { Document, Packer, Paragraph, TextRun } from 'docx';
import { prisma } from '../../../shared/prisma/prisma.client';
import { WorkspaceService } from '../service/implementation/workspace.service';

const m = prisma as unknown as {
  workspace_Document: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
};
const service = new WorkspaceService();
const now = new Date('2026-11-18T10:00:00Z');
const row = (over = {}) => ({ id: 'd1', owner_id: 'u1', title: 'T', template: 'blank', content: '<p>x</p>', created_at: now, updated_at: now, ...over });

beforeEach(() => {
  jest.clearAllMocks();
  m.workspace_Document.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => row(data));
});

describe('a person\'s own documents', () => {
  it('every lookup is scoped to the owner, so someone else\'s document reads as not found', async () => {
    m.workspace_Document.findFirst.mockResolvedValue(null);
    await expect(service.get('d1', 'intruder')).rejects.toThrow(/not found/i);
    expect(m.workspace_Document.findFirst.mock.calls[0][0].where).toEqual({ id: 'd1', owner_id: 'intruder', deleted_at: null });
  });

  it('the list only asks for the owner\'s live documents, newest first', async () => {
    m.workspace_Document.findMany.mockResolvedValue([row()]);
    await service.list('u1', { search: 'plan' });
    const args = m.workspace_Document.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ owner_id: 'u1', deleted_at: null, title: { contains: 'plan' } });
    expect(args.orderBy).toEqual({ updated_at: 'desc' });
  });

  it('cannot save to or delete someone else\'s document', async () => {
    m.workspace_Document.findFirst.mockResolvedValue(null);
    await expect(service.update('d1', { content: 'x' }, 'intruder')).rejects.toThrow();
    await expect(service.remove('d1', 'intruder')).rejects.toThrow();
    expect(m.workspace_Document.update).not.toHaveBeenCalled();
  });

  it('deleting is a soft delete', async () => {
    m.workspace_Document.findFirst.mockResolvedValue(row());
    await service.remove('d1', 'u1');
    expect(m.workspace_Document.update.mock.calls[0][0].data.deleted_at).toBeInstanceOf(Date);
  });
});

describe('starting a document', () => {
  it('a blank page starts empty', async () => {
    const doc = await service.create({ title: 'Notes', template: 'blank' }, { id: 'u1', displayName: 'Ada' });
    expect(doc.content).toBe('<p></p>');
  });

  it('the GBB template starts with the cover, front matter tables and a body, all editable content', async () => {
    const doc = await service.create({ title: 'Audit Charter', template: 'gbb' }, { id: 'u1', displayName: 'Ada Obi' });
    for (const expected of ['Galaxy Backbone Limited', 'Audit Charter', 'Document Information', 'Change history', 'Distribution List', 'Approval List', 'Change Control', 'Ada Obi', 'data:image/png;base64,']) {
      expect(doc.content).toContain(expected);
    }
    expect(doc.template).toBe('gbb');
  });

  it('escapes a title so it cannot inject markup into the template', async () => {
    const doc = await service.create({ title: '<script>x</script>', template: 'gbb' }, { id: 'u1', displayName: 'Ada' });
    expect(doc.content).not.toContain('<script>');
  });
});

describe('importing a Word file', () => {
  const docx = async (text: string): Promise<Buffer> =>
    Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] }] }));

  it('converts a .docx to editor HTML, keeping the text and formatting', async () => {
    const r = await service.importWord({ originalname: 'Policy.docx', buffer: await docx('Hello policy') });
    expect(r.title).toBe('Policy');
    expect(r.html).toContain('Hello policy');
    expect(r.html).toContain('<strong>');
  });

  it('refuses anything that is not a .docx', async () => {
    await expect(service.importWord({ originalname: 'old.doc', buffer: Buffer.from('x') })).rejects.toThrow(/\.docx/);
  });

  it('says so when the file is not a readable Word document', async () => {
    await expect(service.importWord({ originalname: 'bad.docx', buffer: Buffer.from('not a zip') })).rejects.toThrow(/could not be read/);
  });
});
