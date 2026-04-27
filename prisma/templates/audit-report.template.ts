// prisma/templates/audit-report.template.ts
//
// Document.xml body for the internal audit report template. Uses
// docxtemplater `{tag}` placeholders and `{#findings}{/findings}` loops.

export const AUDIT_REPORT_TEMPLATE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t xml:space="preserve">GALAXY BACKBONE LIMITED</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">Internal Audit Management System</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">INTERNAL AUDIT REPORT</w:t></w:r></w:p>
    <w:p/>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Report Title: </w:t></w:r><w:r><w:t xml:space="preserve">{title}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Engagement Reference: </w:t></w:r><w:r><w:t xml:space="preserve">{engagementReference}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Engagement Title: </w:t></w:r><w:r><w:t xml:space="preserve">{engagementTitle}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Date Exported: </w:t></w:r><w:r><w:t xml:space="preserve">{date}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Status: </w:t></w:r><w:r><w:t xml:space="preserve">{status}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Version: </w:t></w:r><w:r><w:t xml:space="preserve">{version}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Issued: </w:t></w:r><w:r><w:t xml:space="preserve">{issuedAt}</w:t></w:r></w:p>
    <w:p/>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">1. Executive Summary</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">{executiveSummary}</w:t></w:r></w:p>
    <w:p/>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">2. Scope</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">{scope}</w:t></w:r></w:p>
    <w:p/>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">3. Methodology</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">{methodology}</w:t></w:r></w:p>
    <w:p/>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">4. Findings ({findingCount})</w:t></w:r></w:p>
    {#findings}
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">{index}. {title}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Severity: </w:t></w:r><w:r><w:t xml:space="preserve">{severity}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Category: </w:t></w:r><w:r><w:t xml:space="preserve">{category}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Status: </w:t></w:r><w:r><w:t xml:space="preserve">{status}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Due Date: </w:t></w:r><w:r><w:t xml:space="preserve">{dueDate}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Description:</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">{description}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Root Cause:</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">{rootCause}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Risk Implication:</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">{riskImplication}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Recommendation:</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">{recommendation}</w:t></w:r></w:p>
    <w:p/>
    {/findings}
    <w:p/>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">Galaxy Backbone Limited - Internal Audit - Confidential</w:t></w:r></w:p>
  </w:body>
</w:document>`;
