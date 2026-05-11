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
              new docx.TextRun({ children: [docx.PageNumber.CURRENT], size: 18 }),
              new docx.TextRun({ text: ' of ', size: 18 }),
              new docx.TextRun({ children: [docx.PageNumber.TOTAL_PAGES], size: 18 }),
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
  fs.writeFileSync('test-footer.docx', buffer);
  console.log('Written test-footer.docx');
}).catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
});
