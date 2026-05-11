const docx = require('docx');
const fs = require('fs');

const doc = new docx.Document({
  sections: [{
    children: [
      new docx.Table({
        rows: [
          new docx.TableRow({
            children: [
              new docx.TableCell({
                children: [new docx.Paragraph({ children: [new docx.TextRun('Header')] })],
                shading: { fill: '003087', type: docx.ShadingType.SOLID },
              }),
              new docx.TableCell({
                children: [new docx.Paragraph({ children: [new docx.TextRun('Critical')] })],
                shading: { fill: 'DC2626', type: docx.ShadingType.SOLID },
              }),
            ],
          }),
        ],
      }),
    ],
  }],
});

docx.Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('test-shading.docx', buffer);
  console.log('Written test-shading.docx');
}).catch(err => {
  console.error('Error:', err.message);
});
