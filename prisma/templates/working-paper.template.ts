// prisma/templates/working-paper.template.ts
//
// Document.xml body for the audit working paper template. Uses docxtemplater
// `{tag}` placeholders. The render utility wraps this in a minimal valid
// .docx archive at export time.

export const WORKING_PAPER_TEMPLATE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t xml:space="preserve">GALAXY BACKBONE LIMITED</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">Internal Audit Management System</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">AUDIT WORKING PAPER</w:t></w:r></w:p>
    <w:p/>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Title: </w:t></w:r><w:r><w:t xml:space="preserve">{title}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Engagement Reference: </w:t></w:r><w:r><w:t xml:space="preserve">{engagementReference}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Engagement Title: </w:t></w:r><w:r><w:t xml:space="preserve">{engagementTitle}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Auditor: </w:t></w:r><w:r><w:t xml:space="preserve">{auditorName}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Date Exported: </w:t></w:r><w:r><w:t xml:space="preserve">{date}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Status: </w:t></w:r><w:r><w:t xml:space="preserve">{status}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Version: </w:t></w:r><w:r><w:t xml:space="preserve">{version}</w:t></w:r></w:p>
    <w:p/>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">Content</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">{content}</w:t></w:r></w:p>
    <w:p/>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">Galaxy Backbone Limited - Internal Audit - Confidential</w:t></w:r></w:p>
  </w:body>
</w:document>`;
