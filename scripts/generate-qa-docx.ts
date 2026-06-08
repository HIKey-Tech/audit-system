import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  VerticalAlign,
  ShadingType,
  Footer,
  PageNumber,
  convertInchesToTwip
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';

// Helper to create regular body paragraphs
function createBodyParagraph(text: string, options: { bold?: boolean; italic?: boolean; color?: string; size?: number; before?: number; after?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { before: options.before ?? 0, after: options.after ?? 120 },
    alignment: AlignmentType.LEFT,
    children: [
      new TextRun({
        text,
        bold: options.bold,
        italics: options.italic,
        color: options.color,
        size: options.size ?? 22, // 22 twip = 11 pt
      }),
    ],
  });
}

// Helper to create bullets
function createBulletParagraph(text: string, options: { boldText?: string; size?: number } = {}): Paragraph {
  const children: TextRun[] = [];
  if (options.boldText) {
    children.push(new TextRun({ text: options.boldText, bold: true, size: options.size ?? 22 }));
  }
  children.push(new TextRun({ text, size: options.size ?? 22 }));
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children,
  });
}

// Helper to create colored section headings
function createHeading(text: string, level: 1 | 2 | 3): Paragraph {
  const sizes = { 1: 32, 2: 26, 3: 22 };
  const colors = { 1: '003087', 2: 'EA580C', 3: '0F172A' };
  const before = { 1: 360, 2: 240, 3: 180 };
  const after = { 1: 180, 2: 120, 3: 80 };

  return new Paragraph({
    spacing: { before: before[level], after: after[level] },
    keepNext: true,
    children: [
      new TextRun({
        text,
        bold: true,
        size: sizes[level],
        color: colors[level],
      }),
    ],
  });
}

// Helper for table cells
function createTableCell(text: string, options: { bold?: boolean; bg?: string; textCol?: string; span?: number; align?: any; size?: number } = {}): TableCell {
  return new TableCell({
    columnSpan: options.span,
    children: [
      new Paragraph({
        alignment: options.align ?? AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: options.bold,
            color: options.textCol ?? '000000',
            size: options.size ?? 20, // 10 pt
          }),
        ],
      }),
    ],
    shading: options.bg ? { fill: options.bg, type: ShadingType.SOLID } : undefined,
    verticalAlign: VerticalAlign.CENTER,
  });
}

function buildDocument(): Document {
  const children: (Paragraph | Table)[] = [];

  // ==========================================
  // TITLE PAGE
  // ==========================================
  children.push(new Paragraph({ spacing: { before: 1200 } })); // Large space at top
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: 'GALAXY BACKBONE LIMITED (GBB)',
        bold: true,
        size: 24,
        color: '64748B',
      }),
    ],
  }));

  children.push(new Paragraph({ spacing: { before: 240, after: 240 } }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: 'INTERNAL AUDIT MANAGEMENT SOFTWARE (IAMS)',
        bold: true,
        size: 38,
        color: '003087',
      }),
    ],
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 480 },
    children: [
      new TextRun({
        text: 'Comprehensive System Specification, RBAC Directory, and End-to-End QA Manual Testing Guide',
        italics: true,
        size: 24,
        color: '0F172A',
      }),
    ],
  }));

  // Divider
  children.push(new Paragraph({
    spacing: { after: 1200 },
    border: { bottom: { color: '003087', style: BorderStyle.SINGLE, size: 18 } },
    children: [],
  }));

  // Metadata Table
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    },
    rows: [
      new TableRow({
        children: [
          createTableCell('Document Version', { bold: true, bg: 'F3F4F6' }),
          createTableCell('1.0.0 (Release-Ready Reference)'),
        ],
      }),
      new TableRow({
        children: [
          createTableCell('Client Owner', { bold: true, bg: 'F3F4F6' }),
          createTableCell('Galaxy Backbone Limited (GBB) - Internal Audit Dept'),
        ],
      }),
      new TableRow({
        children: [
          createTableCell('Release State', { bold: true, bg: 'F3F4F6' }),
          createTableCell('System Deployed / Pre-QA Sign-off'),
        ],
      }),
      new TableRow({
        children: [
          createTableCell('Document Classification', { bold: true, bg: 'F3F4F6' }),
          createTableCell('GBB Internal & Confidential', { bold: true, textCol: 'DC2626' }),
        ],
      }),
    ],
  }));

  // Page break for the next section
  children.push(new Paragraph({ pageBreakBefore: true }));

  // ==========================================
  // SECTION 1: SYSTEM OVERVIEW
  // ==========================================
  children.push(createHeading('1. System Context & Business Overview', 1));
  children.push(createBodyParagraph(
    'The Internal Audit Management Software (IAMS) is a custom enterprise platform developed for Galaxy Backbone Limited (GBB), a Federal Government of Nigeria information technology service provider. The system is designed to digitalize and automate GBB\'s end-to-end internal audit lifecycle, transitioning operations from manual paper-based or spreadsheet workflows into a structured, trackable, and role-governed environment.'
  ));

  children.push(createHeading('1.1 Deployment & Environmental Context', 2));
  children.push(createBodyParagraph(
    'IAMS is engineered for on-premises hosting within GBB\'s private cloud (GCS - Galaxy Cloud Services) or on-prem datacenters. It relies on a Microsoft SQL Server database schema and integrates directly with corporate Active Directory for user access control.'
  ));

  children.push(createHeading('1.2 Compliance Scope & Mandates', 2));
  children.push(createBodyParagraph(
    'To support GBB\'s role as an infrastructure and security provider, the software embeds compliance hooks and terminology aligned with the following global standards:'
  ));
  children.push(createBulletParagraph(' ISO 27001 (Information Security Management System)', { boldText: '• ' }));
  children.push(createBulletParagraph(' ISO 9001 (Quality Management System)', { boldText: '• ' }));
  children.push(createBulletParagraph(' ISO 20000 (IT Service Management)', { boldText: '• ' }));
  children.push(createBulletParagraph(' ISO 22301 (Business Continuity Management)', { boldText: '• ' }));
  children.push(createBulletParagraph(' NDPR (Nigeria Data Protection Regulation)', { boldText: '• ' }));
  children.push(createBulletParagraph(' COBIT & NIST (IT Security & Governance Frameworks)', { boldText: '• ' }));
  children.push(createBulletParagraph(' PCI DSS (Payment Card Industry Data Security Standard)', { boldText: '• ' }));

  children.push(createHeading('1.3 External Systems Interactivity (Read-Only)', 2));
  children.push(createBodyParagraph(
    'To maintain a clear boundary of corporate state, IAMS connects to GBB\'s existing tools in a strict READ-ONLY manner via structural adapters. Under no circumstances does IAMS write back to these external systems:'
  ));
  children.push(createBulletParagraph(' Dynafin: GBB\'s primary Enterprise Resource Planning (ERP) suite. Extracted data is used to verify procurement logs, assets, and departmental transactions.', { boldText: '• ERP (Dynafin): ' }));
  children.push(createBulletParagraph(' IMOC: GBB\'s IT Service Management (ITSM) tool. Extracted data provides IT incident records, service levels, and system change lists.', { boldText: '• ITSM (IMOC): ' }));
  children.push(createBulletParagraph(' Active Directory (AD): Supplies organization charts, staff profiles, and corporate authentication.', { boldText: '• Identity (AD): ' }));
  children.push(createBulletParagraph(' Project Plus: Corporate project registry, permitting auditor tracking of ongoing government IT initiatives.', { boldText: '• Projects (Project Plus): ' }));
  children.push(createBulletParagraph(' Shared Drive: Legacy document storage archives, read for historical audit documentation references.', { boldText: '• Shared Drive: ' }));

  // ==========================================
  // SECTION 2: SYSTEM ARCHITECTURE & FEATURES
  // ==========================================
  children.push(createHeading('2. Tech Stack & Environment Guide', 1));
  children.push(createBodyParagraph(
    'The system is implemented as a Modular Monolith, combining all services into a single database schema and Node.js process while enforcing structural separation.'
  ));

  children.push(createBulletParagraph(' Node.js (v20+) with Express and strict-mode TypeScript.', { boldText: '• Backend Layer: ' }));
  children.push(createBulletParagraph(' Prisma ORM connected to Microsoft SQL Server.', { boldText: '• Database Layer: ' }));
  children.push(createBulletParagraph(' Next.js (v14 App Router) utilizing Tailwind CSS for a premium, clean enterprise UI.', { boldText: '• Frontend Layer: ' }));
  children.push(createBulletParagraph(' OpenID Connect (OIDC) integrated with Azure AD, plus a secure local credentials database for failover and developer environments.', { boldText: '• Authentication: ' }));
  children.push(createBulletParagraph(' Local storage adapter for file binaries during development (UUID-encrypted file naming), swap-ready for Azure Blob Storage in production.', { boldText: '• Storage Adapter: ' }));
  children.push(createBulletParagraph(' node-cron runner writing job status to SQL Server tables (`scheduled_jobs` / `scheduled_job_runs`) for automated compliance checks.', { boldText: '• Background Jobs: ' }));

  children.push(createHeading('2.1 Running the QA Environment', 2));
  children.push(createBodyParagraph(
    'Ensure that the following endpoints are accessible in the local QA testing sandbox:'
  ));
  children.push(createBulletParagraph(' http://localhost:3000 — Backend REST API server.', { boldText: '1. Backend API: ' }));
  children.push(createBulletParagraph(' http://localhost:3001 — Next.js administrative frontend web portal.', { boldText: '2. Frontend Web App: ' }));
  children.push(createBulletParagraph(' http://localhost:3000/docs — Swagger OpenAPI document explorer.', { boldText: '3. API documentation: ' }));

  // ==========================================
  // SECTION 3: SYSTEM MODULES AND PAGES
  // ==========================================
  children.push(createHeading('3. Detailed Module & Page Directory', 1));
  children.push(createBodyParagraph(
    'IAMS consists of 10 logical backend modules and 21 distinct web routes. Below is the full directory detailing what works, where it resides, and what it covers.'
  ));

  // Modules Table
  const modulesHeaderRow = new TableRow({
    children: [
      createTableCell('Module Name', { bold: true, bg: '003087', textCol: 'FFFFFF' }),
      createTableCell('Web Routes', { bold: true, bg: '003087', textCol: 'FFFFFF' }),
      createTableCell('Status / Functionality', { bold: true, bg: '003087', textCol: 'FFFFFF' }),
    ],
  });

  const modulesRows = [
    new TableRow({
      children: [
        createTableCell('1. Auth / User', { bold: true }),
        createTableCell('/login\n/users\n/users/:id'),
        createTableCell('Complete. Handles OIDC and local credentials login, profile management, password resets, and user skills tags.'),
      ],
    }),
    new TableRow({
      children: [
        createTableCell('2. Dashboard', { bold: true }),
        createTableCell('/dashboard'),
        createTableCell('Complete. Role-specific dashboards. Auditees see only their pending findings; CAE/Managers see summaries, charts, workload, and escalations.'),
      ],
    }),
    new TableRow({
      children: [
        createTableCell('3. Risk Register', { bold: true }),
        createTableCell('/risk\n/risk/[id]'),
        createTableCell('Complete. Holds enterprise risks, categories, and assessments. Scores multiply likelihood * impact, plotting trend lines.'),
      ],
    }),
    new TableRow({
      children: [
        createTableCell('4. Audit Universe', { bold: true }),
        createTableCell('/audit/universe\n/audit/universe/[id]'),
        createTableCell('Complete. List of GBB assets/departments. Recalculates risk scores based on linked Risk Register assessments.'),
      ],
    }),
    new TableRow({
      children: [
        createTableCell('5. Audit Planning', { bold: true }),
        createTableCell('/audit/plans\n/audit/plans/[id]'),
        createTableCell('Complete. Drafts annual plans, adds universe items, and runs approvals through Workflow.Rollover creates engagements.'),
      ],
    }),
    new TableRow({
      children: [
        createTableCell('6. Engagements', { bold: true }),
        createTableCell('/audit/engagements\n/audit/engagements/[id]'),
        createTableCell('Complete. Tabbed engagement console. Houses checklists, working papers, evidence uploads, findings, reports, and follow-ups.'),
      ],
    }),
    new TableRow({
      children: [
        createTableCell('7. Documents', { bold: true }),
        createTableCell('/documents'),
        createTableCell('Complete. Explorer interface. Manages document uploads, version snapshots, templates, and server-side storage streaming.'),
      ],
    }),
    new TableRow({
      children: [
        createTableCell('8. Workflow Hub', { bold: true }),
        createTableCell('/workflow'),
        createTableCell('Complete. Handles inbox approvals, staff assignments, escalation schedules (L1 to L4), and policy configs.'),
      ],
    }),
    new TableRow({
      children: [
        createTableCell('9. Audit Trail Logs', { bold: true }),
        createTableCell('/logs'),
        createTableCell('Complete. Log directory capturing IP, user agent, module, action, and JSON diffs of changes.'),
      ],
    }),
    new TableRow({
      children: [
        createTableCell('10. System Settings', { bold: true }),
        createTableCell('/settings'),
        createTableCell('Complete. Houses default templates, config key/value overrides, audit lifecycle rules, and role permission tables.'),
      ],
    }),
    new TableRow({
      children: [
        createTableCell('11. Integrations', { bold: true }),
        createTableCell('/integrations'),
        createTableCell('Placeholder Shell. UI displays "Coming Soon" while external integrations remain mocked for testing.'),
      ],
    }),
    new TableRow({
      children: [
        createTableCell('12. Predictive', { bold: true }),
        createTableCell('/predictive'),
        createTableCell('Placeholder Shell. UI displays "Coming Soon" for future AI NLP finding classifiers.'),
      ],
    }),
  ];

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    },
    rows: [modulesHeaderRow, ...modulesRows],
  }));

  children.push(new Paragraph({ pageBreakBefore: true }));

  // ==========================================
  // SECTION 4: PERMISSIONS CATALOG
  // ==========================================
  children.push(createHeading('4. Complete Permissions Catalog', 1));
  children.push(createBodyParagraph(
    'IAMS enforces access security using granular permissions mapped to specific roles. Below is the list of all 60 system permissions defined in the database.'
  ));

  const permHeaderRow = new TableRow({
    children: [
      createTableCell('Permission Slug', { bold: true, bg: '003087', textCol: 'FFFFFF' }),
      createTableCell('Functional Module', { bold: true, bg: '003087', textCol: 'FFFFFF' }),
      createTableCell('Action Description', { bold: true, bg: '003087', textCol: 'FFFFFF' }),
    ],
  });

  const permRows = [
    // User
    new TableRow({ children: [createTableCell('user:read'), createTableCell('User / Auth'), createTableCell('Allows viewing profiles, users list, and skill tags')] }),
    new TableRow({ children: [createTableCell('user:create'), createTableCell('User / Auth'), createTableCell('Allows creating new local users in the database')] }),
    new TableRow({ children: [createTableCell('user:update'), createTableCell('User / Auth'), createTableCell('Allows modifying existing profiles and credentials')] }),
    new TableRow({ children: [createTableCell('user:delete'), createTableCell('User / Auth'), createTableCell('Performs a soft-delete on users (sets deleted_at)')] }),
    new TableRow({ children: [createTableCell('user:admin'), createTableCell('User / Auth'), createTableCell('Full RBAC administrative controls (role assignments)')] }),
    new TableRow({ children: [createTableCell('role:read / create / update / delete'), createTableCell('User / Auth'), createTableCell('Access to manage the roles registry')] }),
    
    // Risk
    new TableRow({ children: [createTableCell('risk:read / read_all'), createTableCell('Risk Module'), createTableCell('Access to search and view the corporate risk registry')] }),
    new TableRow({ children: [createTableCell('risk:create / update / delete'), createTableCell('Risk Module'), createTableCell('Access to log and modify risks in the registry')] }),
    new TableRow({ children: [createTableCell('risk:assess'), createTableCell('Risk Module'), createTableCell('Allows submitting new L * I assessments and updating scores')] }),
    new TableRow({ children: [createTableCell('risk_category:read / write / delete'), createTableCell('Risk Module'), createTableCell('Allows managing categories (e.g. Financial, IT)')] }),

    // Audit Universe & planning
    new TableRow({ children: [createTableCell('universe:read / create / update / delete'), createTableCell('Audit Module'), createTableCell('Manages the auditable assets and entities list')] }),
    new TableRow({ children: [createTableCell('plan:read / create / update'), createTableCell('Audit Module'), createTableCell('Allows drafting and editing annual audit plans')] }),
    new TableRow({ children: [createTableCell('plan:add_item'), createTableCell('Audit Module'), createTableCell('Allows linking audit universe items to draft plans')] }),
    new TableRow({ children: [createTableCell('plan:submit'), createTableCell('Audit Module'), createTableCell('Triggers the plan approval workflow request')] }),
    new TableRow({ children: [createTableCell('plan:approve / reject'), createTableCell('Audit Module'), createTableCell('Executive authority to approve/reject draft plans')] }),

    // Engagements & checklist
    new TableRow({ children: [createTableCell('engagement:read / read_all'), createTableCell('Audit Module'), createTableCell('Permission to view active/planned audit engagements')] }),
    new TableRow({ children: [createTableCell('engagement:create / update / delete'), createTableCell('Audit Module'), createTableCell('Permission to initialize engagements from plans')] }),
    new TableRow({ children: [createTableCell('checklist:read / update'), createTableCell('Audit Module'), createTableCell('Controls checklists access, running tests')] }),

    // Working papers & evidence
    new TableRow({ children: [createTableCell('working_paper:read / create / update'), createTableCell('Audit Module'), createTableCell('Allows drafting and compiling working papers')] }),
    new TableRow({ children: [createTableCell('working_paper:submit'), createTableCell('Audit Module'), createTableCell('Submits working papers to managers for review')] }),
    new TableRow({ children: [createTableCell('working_paper:approve / reject'), createTableCell('Audit Module'), createTableCell('Managerial approval of working papers')] }),
    new TableRow({ children: [createTableCell('evidence:read / upload / dispute'), createTableCell('Audit Module'), createTableCell('Allows auditors and auditees to manage evidence files')] }),

    // Findings & reports
    new TableRow({ children: [createTableCell('finding:read / read_all / create / update / close'), createTableCell('Audit Module'), createTableCell('Complete management of findings raised during audits')] }),
    new TableRow({ children: [createTableCell('followup:read / respond / evidence / verify'), createTableCell('Audit Module'), createTableCell('Manages follow-up actions and auditee remediations')] }),
    new TableRow({ children: [createTableCell('report:read / create / update / export'), createTableCell('Audit Module'), createTableCell('Allows drafting and reviewing final audit reports')] }),
    new TableRow({ children: [createTableCell('report:submit / approve / reject'), createTableCell('Audit Module'), createTableCell('Governs report approval workflow steps')] }),
    new TableRow({ children: [createTableCell('report:issue'), createTableCell('Audit Module'), createTableCell('CAE only. Closes the audit and issues report to GBB')] }),

    // Other System Permissions
    new TableRow({ children: [createTableCell('document:read / write / delete'), createTableCell('Document Module'), createTableCell('Direct backend operations on file assets')] }),
    new TableRow({ children: [createTableCell('log:read / summary'), createTableCell('Logging Module'), createTableCell('Allows viewing security audit trails')] }),
    new TableRow({ children: [createTableCell('job:read / admin'), createTableCell('Background Jobs'), createTableCell('Allows executing and managing background crons')] }),
    new TableRow({ children: [createTableCell('settings:read / manage'), createTableCell('Settings Module'), createTableCell('Modifying system thresholds, configs, and matrices')] }),
  ];

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    },
    rows: [permHeaderRow, ...permRows],
  }));

  children.push(new Paragraph({ pageBreakBefore: true }));

  // ==========================================
  // SECTION 5: SEEDED USERS
  // ==========================================
  children.push(createHeading('5. Seeded Test Users & Credentials', 1));
  children.push(createBodyParagraph(
    'Use the following seeded accounts during manual testing. They have been configured with specific role allocations representing GBB\'s organizational structure.'
  ));

  const userHeaderRow = new TableRow({
    children: [
      createTableCell('DisplayName', { bold: true, bg: '003087', textCol: 'FFFFFF' }),
      createTableCell('Email Address', { bold: true, bg: '003087', textCol: 'FFFFFF' }),
      createTableCell('Primary Role', { bold: true, bg: '003087', textCol: 'FFFFFF' }),
      createTableCell('Local Dev Password', { bold: true, bg: '003087', textCol: 'FFFFFF' }),
    ],
  });

  const userRows = [
    new TableRow({ children: [createTableCell('Bello Adesanya (CAE/Admin)'), createTableCell('admin@example.com'), createTableCell('super_admin'), createTableCell('Bello@123456!')] }),
    new TableRow({ children: [createTableCell('Tunde Bakare (Lead Auditor)'), createTableCell('tunde@gbb.gov.ng'), createTableCell('audit_lead'), createTableCell('Tunde@123456!')] }),
    new TableRow({ children: [createTableCell('Adaeze Okonkwo (Audit Mgr)'), createTableCell('adaeze@gbb.gov.ng'), createTableCell('audit_manager'), createTableCell('Adaeze@123456!')] }),
    new TableRow({ children: [createTableCell('Emeka Eze (Staff Auditor)'), createTableCell('emeka@gbb.gov.ng'), createTableCell('auditor'), createTableCell('Emeka@123456!')] }),
    new TableRow({ children: [createTableCell('Chisom Okafor (Head Finance)'), createTableCell('chisom@gbb.gov.ng'), createTableCell('auditee'), createTableCell('Chisom@123456!')] }),
    new TableRow({ children: [createTableCell('Ibrahim Musa (Director)'), createTableCell('ibrahim@gbb.gov.ng'), createTableCell('director'), createTableCell('Ibrahim@123456!')] }),
    new TableRow({ children: [createTableCell('Fatima Aliyu (Executive CAE)'), createTableCell('fatima@gbb.gov.ng'), createTableCell('cae'), createTableCell('Fatima@123456!')] }),
  ];

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    },
    rows: [userHeaderRow, ...userRows],
  }));

  children.push(new Paragraph({ pageBreakBefore: true }));

  // ==========================================
  // SECTION 6: E2E MANUAL TESTING GUIDE
  // ==========================================
  children.push(createHeading('6. End-to-End Manual Testing Manual', 1));
  children.push(createBodyParagraph(
    'This section details the manual testing scenarios to execute. QAs should perform these in order to verify full business integration.'
  ));

  // Scenario 1
  children.push(createHeading('Scenario 1: Risk-Universe Integration & Assessment', 2));
  children.push(createBodyParagraph(
    'Purpose: Verify that establishing a risk and scoring it dynamically updates the Audit Universe entity\'s score, driving automated audit scheduling priorities.'
  ));
  children.push(createBulletParagraph(' Login to the portal (http://localhost:3001) as Auditor: emeka@gbb.gov.ng / Emeka@123456!.', { boldText: 'Step 1: ' }));
  children.push(createBulletParagraph(' Go to "Audit Universe" (/audit/universe) via the navigation sidebar. Inspect the list. Click on "Finance Department". Take note of the current "Calculated Risk Score" (e.g. 0 or a low baseline).', { boldText: 'Step 2: ' }));
  children.push(createBulletParagraph(' Go to "Risk Register" (/risk) via the sidebar. Click "New Risk". Set Title to "Unauthorized Treasury Withdrawals", select Category = "Financial", and under "Linked Universe Entity" dropdown choose "Finance Department". Click "Create Risk".', { boldText: 'Step 3: ' }));
  children.push(createBulletParagraph(' Navigate to the newly created risk details page. Click the "Record Assessment" button. Set Likelihood = 4 and Impact = 5 (High-Critical quadrant). Input assessor notes and click "Submit Assessment".', { boldText: 'Step 4: ' }));
  children.push(createBulletParagraph(' Go back to "Audit Universe" (/audit/universe) and select "Finance Department". Verify that the Risk Score has updated to 20 (Likelihood * Impact) and that the status has flagged as High Priority.', { boldText: 'Step 5: ' }));
  children.push(createBulletParagraph(' Verify that a GET request to `/api/v1/universe/{id}` returns the updated score and that `/api/v1/logs` registers the audit-trail entry.', { boldText: 'Step 6 (API Verification): ' }));

  // Scenario 2
  children.push(createHeading('Scenario 2: Annual Plan Compilation & Rejection Workflow', 2));
  children.push(createBodyParagraph(
    'Purpose: Verify that annual planning items can be compiled, submitted to the CAE, rejected with remarks, revised, and subsequently approved.'
  ));
  children.push(createBulletParagraph(' Login as Lead Auditor: tunde@gbb.gov.ng / Tunde@123456!.', { boldText: 'Step 1: ' }));
  children.push(createBulletParagraph(' Go to "Audit Plans" (/audit/plans). Click "New Plan". Enter "2027 Annual Audit Plan" and select Year = 2027. Save as Draft.', { boldText: 'Step 2: ' }));
  children.push(createBulletParagraph(' Open the draft plan, click "Add Plan Item". Select Universe Entity = "Finance Department", Priority = "High", Audit Type = "Financial", and Quarter = "Q1". Save.', { boldText: 'Step 3: ' }));
  children.push(createBulletParagraph(' Click "Submit for Approval". The status should change to "submitted". Close session.', { boldText: 'Step 4: ' }));
  children.push(createBulletParagraph(' Login as CAE: fatima@gbb.gov.ng / Fatima@123456!.', { boldText: 'Step 5: ' }));
  children.push(createBulletParagraph(' Go to "Workflow Hub" (/workflow). Under "Approval Inbox", click the pending item "2027 Annual Audit Plan". Click "Reject". Input reason: "Add IT Infrastructure Audit before approval" and click Submit.', { boldText: 'Step 6: ' }));
  children.push(createBulletParagraph(' Verify the plan status in the UI transitions to "rejected".', { boldText: 'Step 7: ' }));
  children.push(createBulletParagraph(' Login back as Lead Auditor (Tunde). Add "IT Infrastructure" to the plan and click "Submit for Approval" again.', { boldText: 'Step 8: ' }));
  children.push(createBulletParagraph(' Login back as CAE (Fatima). Locate the plan in your inbox and click "Approve". Verify the status changes to "approved".', { boldText: 'Step 9: ' }));

  // Scenario 3
  children.push(createHeading('Scenario 3: Engagement Initialization & Checklist Auditing', 2));
  children.push(createBodyParagraph(
    'Purpose: Convert an approved plan item into an active audit engagement, allocate resources, and fail a control checklist test to document deficiencies.'
  ));
  children.push(createBulletParagraph(' Logged in as Lead Auditor (Tunde), go to "Audit Plans" (/audit/plans) and click the approved "2027 Annual Audit Plan".', { boldText: 'Step 1: ' }));
  children.push(createBulletParagraph(' Select the "Finance Department" plan item. Click "Initialize Engagement". Set SLA Deadline (e.g. 1 month out) and click "Create". Engagement status is now "planned".', { boldText: 'Step 2: ' }));
  children.push(createBulletParagraph(' Go to the newly created Engagement details. Click the "Assignments" tab, click "Assign Staff". Assign Emeka Eze as the Auditor, and Tunde Bakare as the Lead. Click Save. Engagement status transitions to "in_progress".', { boldText: 'Step 3: ' }));
  children.push(createBulletParagraph(' Login as Auditor: emeka@gbb.gov.ng. Under "My Work" on the dashboard, click the "Finance Department" engagement.', { boldText: 'Step 4: ' }));
  children.push(createBulletParagraph(' Select the "Checklists" tab. The system should load seeded controls. Edit Control #1 ("Segregation of Duties"). Change status to "Fail", input observations: "Cash handling and reconciliations are managed by the same officer," and Save.', { boldText: 'Step 5: ' }));

  // Scenario 4
  children.push(createHeading('Scenario 4: Working Papers & Evidence Tracking', 2));
  children.push(createBodyParagraph(
    'Purpose: Allow staff to upload testing worksheets, link files to control failures, and obtain review clearance from the lead auditor.'
  ));
  children.push(createBulletParagraph(' In the "Finance Department" engagement (logged in as Emeka), select the "Working Papers" tab. Click "New Working Paper".', { boldText: 'Step 1: ' }));
  children.push(createBulletParagraph(' Select "Standard Financial Audit Working Paper" template. The system loads section headings (Objective, Scope, Procedure, Observations). Fill in details. Under Observations, document the segregation of duties failure.', { boldText: 'Step 2: ' }));
  children.push(createBulletParagraph(' Click "Attach Document / Evidence". Upload a sample file (e.g. PDF or spreadsheet). Click "Submit for Review". The paper transitions to "submitted".', { boldText: 'Step 3: ' }));
  children.push(createBulletParagraph(' Login as Lead Auditor (Tunde). Go to "Workflow Hub" → "Approval Inbox" (or open the engagement details → "Working Papers" tab). Click "Approve". Status transitions to "approved".', { boldText: 'Step 4: ' }));

  // Scenario 5
  children.push(createHeading('Scenario 5: Raising Findings & Auditee Remediation Follow-up', 2));
  children.push(createBodyParagraph(
    'Purpose: Elevate checklist failures to official findings, collect auditee management responses, upload remediation documents, and execute auditor verification.'
  ));
  children.push(createBulletParagraph(' Logged in as Emeka (Auditor), go to the Engagement details → "Findings" tab. Click "Add Finding".', { boldText: 'Step 1: ' }));
  children.push(createBulletParagraph(' Set Title: "Lack of Segregation in Treasury Management". Link to the failed checklist control from Scenario 3. Set Severity = "High", Category = "Financial". Input Root Cause and Recommendations. Click Save.', { boldText: 'Step 2: ' }));
  children.push(createBulletParagraph(' Login as Auditee: chisom@gbb.gov.ng / Chisom@123456! (Head of Finance).', { boldText: 'Step 3: ' }));
  children.push(createBulletParagraph(' On the dashboard, click the active Finding notification. In the details, click "Add Management Response". Enter: "We will recruit a separate accountant to manage bank reconciliations by June 15." Save.', { boldText: 'Step 4: ' }));
  children.push(createBulletParagraph(' Later, click "Submit Remediation Evidence". Upload an evidence PDF (e.g. employee appointment letter or process flow). Click Submit.', { boldText: 'Step 5: ' }));
  children.push(createBulletParagraph(' Login as Auditor (Emeka). Go to the Finding page. Review the uploaded PDF. Click "Verify Remediation". Input verification notes, select "Verified" and click Save. Status updates to "closed".', { boldText: 'Step 6: ' }));

  // Scenario 6
  children.push(createHeading('Scenario 6: Final Audit Report Compiler & 3-Level Approval', 2));
  children.push(createBodyParagraph(
    'Purpose: Assemble the findings into a report, route it through GBB\'s strict manager-director-CAE approval sequence, issue the report, and verify the DOCX export.'
  ));
  children.push(createBulletParagraph(' Login as Auditor (Emeka). In the Engagement page, select the "Report" tab. Click "Generate Draft Report". Select the "Audit Report - GBB Default" template. The system pulls all findings and scopes. Save.', { boldText: 'Step 1: ' }));
  children.push(createBulletParagraph(' Click "Submit Report". The status updates to "submitted" and requires 3 levels of approval.', { boldText: 'Step 2: ' }));
  children.push(createBulletParagraph(' Level 1 Approval: Login as Audit Manager (adaeze@gbb.gov.ng / Adaeze@123456!). Go to "Workflow Hub" → "Approval Inbox". Click "Approve" on the report.', { boldText: 'Step 3: ' }));
  children.push(createBulletParagraph(' Level 2 Approval: Login as Director (ibrahim@gbb.gov.ng / Ibrahim@123456!). Go to "Workflow Hub" → "Approval Inbox". Click "Approve".', { boldText: 'Step 4: ' }));
  children.push(createBulletParagraph(' Level 3 Approval: Login as Executive CAE (fatima@gbb.gov.ng / Fatima@123456!). Go to "Workflow Hub" → "Approval Inbox". Click "Approve".', { boldText: 'Step 5: ' }));
  children.push(createBulletParagraph(' Issue Report: Still logged in as Fatima, open the report and click "Issue Report". The engagement status changes to "reported".', { boldText: 'Step 6: ' }));
  children.push(createBulletParagraph(' Export Verification: Click the "Export Report (Word)" button. Open the downloaded .docx file. Verify that all findings, executive summaries, and approval details are rendered correctly.', { boldText: 'Step 7: ' }));

  children.push(new Paragraph({ pageBreakBefore: true }));

  // ==========================================
  // SECTION 7: OPERATION VERIFICATIONS
  // ==========================================
  children.push(createHeading('7. Operational Auditing & Troubleshooting', 1));
  children.push(createBodyParagraph(
    'Verify that the system background components are functioning correctly:'
  ));

  children.push(createHeading('7.1 Notification System', 2));
  children.push(createBodyParagraph(
    'All event-driven alerts write to a DB-backed queue first rather than executing inline SMTP commands. Inspect `email_logs` and `notification_queue` tables to check email dispatch states. QAs can review active templates via `/api/v1/notifications/templates` and check queue metrics using `/api/v1/notifications/queue/stats`.'
  ));

  children.push(createHeading('7.2 Scheduled Jobs Control', 2));
  children.push(createBodyParagraph(
    'Ensure crons are registered. Go to `/api/v1/jobs` to confirm execution logs for:'
  ));
  children.push(createBulletParagraph(' BG:MESSAGING:NOTIFICATION:QUEUE:EVERY_MINUTE (Processes email queue)', { boldText: '1. ' }));
  children.push(createBulletParagraph(' BG:WORKFLOW:ESCALATION:HOURLY (Checks overdue engagement SLA and approval limits)', { boldText: '2. ' }));
  children.push(createBulletParagraph(' BG:TOKEN:CLEANUP:HOURLY (Clears expired sessions)', { boldText: '3. ' }));
  children.push(createBulletParagraph(' BG:DOCUMENT:VERSION:PRUNE:WEEKLY (Weekly document cleanup job)', { boldText: '4. ' }));

  children.push(createHeading('7.3 Diffs Log Inspection', 2));
  children.push(createBodyParagraph(
    'Navigate to "Logs" (/logs) after completing the E2E scripts. Inspect the latest log. Click to open details and verify the JSON diff payload accurately logs old vs new values alongside IP addresses and user agents.'
  ));

  // Build Document
  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'IAMS QA Manual Test Guide - Page ', size: 18, color: '64748B' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '64748B' }),
                  new TextRun({ text: ' of ', size: 18, color: '64748B' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '64748B' }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
}

async function run() {
  console.log('Generating IAMS QA Test Guide DOCX...');
  const doc = buildDocument();
  const buffer = await Packer.toBuffer(doc);
  const outPath = path.resolve(__dirname, '../docs/QA_TEST_GUIDE.docx');
  fs.writeFileSync(outPath, buffer);
  console.log(`Successfully generated DOCX at: ${outPath}`);
}

run().catch((err) => {
  console.error('Error generating DOCX:', err);
  process.exit(1);
});
