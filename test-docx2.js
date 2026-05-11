const docx = require('docx');
const fs = require('fs');

const doc = new docx.Document({
  sections: [{
    footers: {
      default: new docx.Footer({
        children: [
          new docx.Paragraph({
            alignment: docx.AlignmentType.CENTER,
            children: [
              new docx.TextRun({ text: 'Page ', size: 18 }),
              new docx.SimpleField('PAGE', '1'),
              new docx.TextRun({ text: ' of ', size: 18 }),
              new docx.SimpleField('NUMPAGES', '1'),
            ],
          }),
        ],
      }),
    },
    children: [
      new docx.Paragraph({ children: [new docx.TextRun('Hello world')] }),
      new docx.Paragraph({ children: [new docx.TextRun('Page 2')] }),
    ],
  }],
});

docx.Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('test-footer2.docx', buffer);
  console.log('Written test-footer2.docx');
}).catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
});
