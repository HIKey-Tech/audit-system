import PizZip from 'pizzip';
import mammoth from 'mammoth';
// The Word export lives with the editor in the frontend; it is plain TypeScript with no browser dependency, so it is tested here.
// Loaded at run time (not imported) so the backend's compiler does not pull a frontend file into its source tree.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildDocx } = require('../../../../frontend/lib/workspace/export-docx') as {
  buildDocx: (doc: unknown, opts: { title: string; template: string }) => Promise<Blob>;
};

// A 2x2 PNG (valid header), enough to exercise placement.
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8Dwn4GBgYGJAQoAHhgCAh6X4CYAAAAASUVORK5CYII=';
const t = (text: string, marks: object[] = []) => ({ type: 'text', text, marks });
const para = (...c: object[]) => ({ type: 'paragraph', content: c });

const sample = {
  type: 'doc',
  content: [
    para({ type: 'image', attrs: { src: `data:image/png;base64,${PNG}`, layout: 'behind', x: 10, y: 20, width: 816 } }),
    { type: 'heading', attrs: { level: 1 }, content: [t('Charter')] },
    para(t('Bold', [{ type: 'bold' }]), t(' red', [{ type: 'textStyle', attrs: { color: '#ff0000', fontFamily: 'Georgia', fontSize: '14pt' } }])),
    { type: 'bulletList', content: [{ type: 'listItem', content: [para(t('Point'))] }] },
    {
      type: 'table',
      content: [
        { type: 'tableRow', content: [{ type: 'tableHeader', attrs: {}, content: [para(t('Name'))] }] },
        { type: 'tableRow', content: [{ type: 'tableCell', attrs: {}, content: [para(t('Ada'))] }] },
      ],
    },
    { type: 'pageBreak' },
    para(t('After')),
  ],
};

const xmlOf = async (doc: object, template: string, file = 'word/document.xml'): Promise<string> => {
  const blob = await buildDocx(doc as never, { title: 'Charter', template });
  return new PizZip(Buffer.from(await blob.arrayBuffer())).file(file)!.asText();
};

describe('Word export of an editor document', () => {
  it('is a US Letter document with headings, formatting, lists, tables and a page break', async () => {
    const xml = await xmlOf(sample, 'blank');
    expect(xml).toContain('w:w="12240" w:h="15840"');
    for (const expected of ['w:pStyle w:val="Heading1"', '<w:b/>', 'w:val="FF0000"', 'Georgia', 'w:val="28"', '<w:tbl>', 'w:numId', 'w:type="page"']) {
      expect(xml).toContain(expected);
    }
  });

  it('places a picture behind the text, at the position set in the editor', async () => {
    const xml = await xmlOf(sample, 'blank');
    expect(xml).toContain('behindDoc="1"');
    expect(xml).toContain('<wp:anchor');
    // x = 10px and y = 20px from the page corner, in EMU (1px = 9525)
    expect(xml).toContain('95250');
    expect(xml).toContain('190500');
  });

  it('a picture in front of the text is not behind the document', async () => {
    const front = JSON.parse(JSON.stringify(sample));
    front.content[0].content[0].attrs.layout = 'front';
    expect(await xmlOf(front, 'blank')).toContain('behindDoc="0"');
  });

  it('a picture in line with the text is not anchored', async () => {
    const inline = JSON.parse(JSON.stringify(sample));
    inline.content[0].content[0].attrs.layout = 'inline';
    expect(await xmlOf(inline, 'blank')).not.toContain('<wp:anchor');
  });

  it('the GBB template adds the Galaxy Backbone header and the page numbering footer', async () => {
    expect(await xmlOf(sample, 'gbb', 'word/header1.xml')).toContain('Internal Use Only');
    expect(await xmlOf(sample, 'gbb', 'word/footer1.xml')).toContain('PAGE');
  });

  it('can be read back as a Word document with no problems', async () => {
    const blob = await buildDocx(sample as never, { title: 'Charter', template: 'gbb' });
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(await blob.arrayBuffer()) });
    expect(result.value).toContain('<h1>Charter</h1>');
    expect(result.value).toContain('<td>');
    expect(result.messages.filter((m) => m.type === 'error')).toEqual([]);
  });

  it('copes with an empty document', async () => {
    expect(await xmlOf({ type: 'doc', content: [] }, 'blank')).toContain('<w:body>');
  });
});
