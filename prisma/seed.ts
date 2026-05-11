/// <reference types="node" />
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { WORKING_PAPER_TEMPLATE_XML } from './templates/working-paper.template';
import { AUDIT_REPORT_TEMPLATE_XML } from './templates/audit-report.template';
import { logger } from '../src/shared/utils/logger.util';
import { AppError } from '../src/shared/errors/app.error';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────
// Document templates (DOCX placeholder bodies for export)
// ─────────────────────────────────────────────────────────────
const DOCUMENT_TEMPLATES: Array<{
  name: string;
  description: string;
  category: string;
  content: string;
}> = [
  {
    name: 'Working Paper - GBB Default',
    description:
      'Default DOCX template for audit working paper exports. Placeholders rendered by docxtemplater.',
    category: 'working_paper',
    content: WORKING_PAPER_TEMPLATE_XML,
  },
  {
    name: 'Audit Report - GBB Default',
    description:
      'Default DOCX template for internal audit report exports. Placeholders rendered by docxtemplater.',
    category: 'audit_report',
    content: AUDIT_REPORT_TEMPLATE_XML,
  },
];

// ─────────────────────────────────────────────────────────────
// Notification templates (event-driven body + subject)
// ─────────────────────────────────────────────────────────────
const NOTIFICATION_TEMPLATES: Array<{
  eventKey: string;
  channel: 'email' | 'in_app';
  name: string;
  subject: string | null;
  body: string;
  description: string;
}> = [
  // workflow.approval.created
  {
    eventKey: 'workflow.approval.created',
    channel: 'email',
    name: 'Approval Required — Email',
    subject: 'Action Required: {{entityType}} Awaiting Your Approval',
    body: 'Dear {{approverName}},\n\nA {{entityType}} has been submitted for your approval.\n\nReference: {{entityReference}}\nSubmitted by: {{submitterName}}\nSubmitted at: {{submittedAt}}\n\nPlease log in to IAMS to review and approve or reject.\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Sent to the next approver when an entity (audit plan, working paper, report) is submitted for approval. Variables: approverName, entityType, entityReference, submitterName, submittedAt.',
  },
  {
    eventKey: 'workflow.approval.created',
    channel: 'in_app',
    name: 'Approval Required — In-App',
    subject: null,
    body: "{{entityType}} '{{entityReference}}' submitted by {{submitterName}} requires your approval.",
    description:
      'In-app variant of approval-required notification. Variables: entityType, entityReference, submitterName.',
  },

  // workflow.approval.approved
  {
    eventKey: 'workflow.approval.approved',
    channel: 'email',
    name: 'Approval Completed — Email',
    subject: 'Approved: {{entityType}} {{entityReference}}',
    body: 'Dear {{submitterName}},\n\nYour {{entityType}} has been approved.\n\nReference: {{entityReference}}\nApproved by: {{approverName}}\nComment: {{comment}}\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Sent to the submitter when their submission is fully approved. Variables: submitterName, entityType, entityReference, approverName, comment.',
  },
  {
    eventKey: 'workflow.approval.approved',
    channel: 'in_app',
    name: 'Approval Completed — In-App',
    subject: null,
    body: "{{entityType}} '{{entityReference}}' has been approved by {{approverName}}.",
    description:
      'In-app variant of approval-completed notification. Variables: entityType, entityReference, approverName.',
  },

  // workflow.approval.rejected
  {
    eventKey: 'workflow.approval.rejected',
    channel: 'email',
    name: 'Approval Rejected — Email',
    subject: 'Rejected: {{entityType}} {{entityReference}}',
    body: 'Dear {{submitterName}},\n\nYour {{entityType}} has been rejected and requires revision.\n\nReference: {{entityReference}}\nRejected by: {{approverName}}\nReason: {{rejectionReason}}\n\nPlease log in to IAMS to review and resubmit.\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Sent to the submitter when an approval is rejected. Variables: submitterName, entityType, entityReference, approverName, rejectionReason.',
  },
  {
    eventKey: 'workflow.approval.rejected',
    channel: 'in_app',
    name: 'Approval Rejected — In-App',
    subject: null,
    body: "{{entityType}} '{{entityReference}}' has been rejected by {{approverName}}. Reason: {{rejectionReason}}",
    description:
      'In-app variant of approval-rejected notification. Variables: entityType, entityReference, approverName, rejectionReason.',
  },

  // workflow.assignment.created
  {
    eventKey: 'workflow.assignment.created',
    channel: 'email',
    name: 'Audit Assignment — Email',
    subject: 'New Audit Assignment: {{engagementTitle}}',
    body: 'Dear {{assigneeName}},\n\nYou have been assigned to an audit engagement.\n\nEngagement: {{engagementTitle}}\nReference: {{engagementReference}}\nRole: {{assignmentRole}}\nSLA Deadline: {{slaDeadline}}\n\nPlease log in to IAMS to begin your work.\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Sent to a user when assigned to an audit engagement. Variables: assigneeName, engagementTitle, engagementReference, assignmentRole, slaDeadline.',
  },
  {
    eventKey: 'workflow.assignment.created',
    channel: 'in_app',
    name: 'Audit Assignment — In-App',
    subject: null,
    body: "You have been assigned to engagement '{{engagementTitle}}' ({{engagementReference}}) as {{assignmentRole}}.",
    description:
      'In-app variant of assignment notification. Variables: engagementTitle, engagementReference, assignmentRole.',
  },

  // audit.escalation.level_1
  {
    eventKey: 'audit.escalation.level_1',
    channel: 'email',
    name: 'Audit Escalation Level 1 — Email',
    subject: 'Reminder: Audit Engagement SLA Approaching — {{engagementReference}}',
    body: 'Dear {{recipientName}},\n\nThis is a reminder that the following audit engagement requires attention.\n\nEngagement: {{engagementTitle}}\nReference: {{engagementReference}}\nSLA Deadline: {{slaDeadline}}\nCurrent Status: {{currentStatus}}\n\nPlease log in to IAMS and take action.\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Level-1 escalation reminder for an overdue audit engagement. Variables: recipientName, engagementTitle, engagementReference, slaDeadline, currentStatus.',
  },
  {
    eventKey: 'audit.escalation.level_1',
    channel: 'in_app',
    name: 'Audit Escalation Level 1 — In-App',
    subject: null,
    body: "Reminder: Engagement '{{engagementTitle}}' ({{engagementReference}}) SLA deadline is {{slaDeadline}}.",
    description:
      'In-app variant of level-1 escalation. Variables: engagementTitle, engagementReference, slaDeadline.',
  },

  // audit.escalation.level_2
  {
    eventKey: 'audit.escalation.level_2',
    channel: 'email',
    name: 'Audit Escalation Level 2 — Email',
    subject: 'ESCALATION — Audit Manager Action Required: {{engagementReference}}',
    body: 'Dear {{recipientName}},\n\nAn audit engagement has been escalated to you as Audit Manager due to inaction.\n\nEngagement: {{engagementTitle}}\nReference: {{engagementReference}}\nSLA Deadline: {{slaDeadline}}\nDays Overdue: {{daysOverdue}}\n\nImmediate action is required. Please log in to IAMS.\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Level-2 escalation to audit manager. Variables: recipientName, engagementTitle, engagementReference, slaDeadline, daysOverdue.',
  },
  {
    eventKey: 'audit.escalation.level_2',
    channel: 'in_app',
    name: 'Audit Escalation Level 2 — In-App',
    subject: null,
    body: "ESCALATED: Engagement '{{engagementTitle}}' ({{engagementReference}}) is {{daysOverdue}} days overdue. Action required.",
    description:
      'In-app variant of level-2 escalation. Variables: engagementTitle, engagementReference, daysOverdue.',
  },

  // audit.escalation.level_3
  {
    eventKey: 'audit.escalation.level_3',
    channel: 'email',
    name: 'Audit Escalation Level 3 — Email',
    subject: 'ESCALATION — Director Action Required: {{engagementReference}}',
    body: 'Dear {{recipientName}},\n\nAn audit engagement has been escalated to you as Director.\n\nEngagement: {{engagementTitle}}\nReference: {{engagementReference}}\nSLA Deadline: {{slaDeadline}}\nDays Overdue: {{daysOverdue}}\n\nPlease review and ensure immediate resolution.\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Level-3 escalation to director. Variables: recipientName, engagementTitle, engagementReference, slaDeadline, daysOverdue.',
  },
  {
    eventKey: 'audit.escalation.level_3',
    channel: 'in_app',
    name: 'Audit Escalation Level 3 — In-App',
    subject: null,
    body: "ESCALATED to Director: Engagement '{{engagementTitle}}' ({{engagementReference}}) is {{daysOverdue}} days overdue.",
    description:
      'In-app variant of level-3 escalation. Variables: engagementTitle, engagementReference, daysOverdue.',
  },

  // audit.escalation.level_4
  {
    eventKey: 'audit.escalation.level_4',
    channel: 'email',
    name: 'Audit Escalation Level 4 — Email',
    subject: 'CRITICAL ESCALATION — CAE Action Required: {{engagementReference}}',
    body: 'Dear {{recipientName}},\n\nAn audit engagement has been escalated to you as Chief Audit Executive.\n\nEngagement: {{engagementTitle}}\nReference: {{engagementReference}}\nSLA Deadline: {{slaDeadline}}\nDays Overdue: {{daysOverdue}}\n\nThis requires your immediate attention and intervention.\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Level-4 escalation to CAE. Variables: recipientName, engagementTitle, engagementReference, slaDeadline, daysOverdue.',
  },
  {
    eventKey: 'audit.escalation.level_4',
    channel: 'in_app',
    name: 'Audit Escalation Level 4 — In-App',
    subject: null,
    body: "CRITICAL: Engagement '{{engagementTitle}}' ({{engagementReference}}) escalated to CAE. {{daysOverdue}} days overdue.",
    description:
      'In-app variant of level-4 escalation. Variables: engagementTitle, engagementReference, daysOverdue.',
  },

  // audit.report.issued
  {
    eventKey: 'audit.report.issued',
    channel: 'email',
    name: 'Audit Report Issued — Email',
    subject: 'Audit Report Issued: {{reportTitle}}',
    body: 'Dear {{auditeeName}},\n\nAn audit report has been issued for your area.\n\nReport: {{reportTitle}}\nEngagement: {{engagementTitle}}\nReference: {{engagementReference}}\nIssued by: {{issuedBy}}\nFindings: {{findingCount}} finding(s) requiring your response\n\nPlease log in to IAMS to review the findings and submit your management responses.\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Sent to the auditee when an audit report is issued. Variables: auditeeName, reportTitle, engagementTitle, engagementReference, issuedBy, findingCount.',
  },
  {
    eventKey: 'audit.report.issued',
    channel: 'in_app',
    name: 'Audit Report Issued — In-App',
    subject: null,
    body: "Audit report '{{reportTitle}}' has been issued. {{findingCount}} finding(s) require your response.",
    description:
      'In-app variant of audit-report-issued notification. Variables: reportTitle, findingCount.',
  },

  // audit.followup.response.submitted
  {
    eventKey: 'audit.followup.response.submitted',
    channel: 'email',
    name: 'Management Response Submitted — Email',
    subject: 'Management Response Received: {{findingTitle}}',
    body: 'Dear {{auditorName}},\n\nA management response has been submitted for a finding.\n\nFinding: {{findingTitle}}\nSeverity: {{severity}}\nResponse by: {{auditeeName}}\n\nPlease log in to IAMS to review the response and verify remediation.\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Sent to the auditor when a management response is submitted. Variables: auditorName, findingTitle, severity, auditeeName.',
  },
  {
    eventKey: 'audit.followup.response.submitted',
    channel: 'in_app',
    name: 'Management Response Submitted — In-App',
    subject: null,
    body: "Management response submitted for finding '{{findingTitle}}' by {{auditeeName}}.",
    description:
      'In-app variant of management-response-submitted notification. Variables: findingTitle, auditeeName.',
  },

  // audit.followup.verified
  {
    eventKey: 'audit.followup.verified',
    channel: 'email',
    name: 'Finding Verified — Email',
    subject: 'Finding Verified: {{findingTitle}}',
    body: 'Dear {{auditeeName}},\n\nYour remediation for the following finding has been verified.\n\nFinding: {{findingTitle}}\nVerified by: {{auditorName}}\nNotes: {{verificationNotes}}\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Sent to the auditee when their remediation is verified. Variables: auditeeName, findingTitle, auditorName, verificationNotes.',
  },
  {
    eventKey: 'audit.followup.verified',
    channel: 'in_app',
    name: 'Finding Verified — In-App',
    subject: null,
    body: "Finding '{{findingTitle}}' has been verified as resolved by {{auditorName}}.",
    description:
      'In-app variant of finding-verified notification. Variables: findingTitle, auditorName.',
  },

  // audit.sla.reminder
  {
    eventKey: 'audit.sla.reminder',
    channel: 'email',
    name: 'SLA Reminder — Email',
    subject: 'SLA Deadline Approaching: {{engagementReference}}',
    body: 'Dear {{recipientName}},\n\nThe following audit engagement SLA deadline is approaching in {{daysRemaining}} day(s).\n\nEngagement: {{engagementTitle}}\nReference: {{engagementReference}}\nSLA Deadline: {{slaDeadline}}\n\nPlease ensure the audit is completed on time.\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Reminder sent before an audit engagement SLA deadline. Variables: recipientName, daysRemaining, engagementTitle, engagementReference, slaDeadline.',
  },
  {
    eventKey: 'audit.sla.reminder',
    channel: 'in_app',
    name: 'SLA Reminder — In-App',
    subject: null,
    body: "SLA reminder: Engagement '{{engagementTitle}}' ({{engagementReference}}) deadline in {{daysRemaining}} day(s).",
    description:
      'In-app variant of SLA reminder. Variables: engagementTitle, engagementReference, daysRemaining.',
  },
];

// ─────────────────────────────────────────────────────────────
// Permissions
// ------------------------------------------------------------
type PermissionSeed = {
  slug: string;
  name: string;
  description: string;
  module: string;
  action: string;
};

const toDisplayName = (slug: string): string =>
  slug
    .split(':')
    .map((part) =>
      part
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
    )
    .join(' ');

const permission = (
  slug: string,
  description: string,
  module: string,
): PermissionSeed => ({
  slug,
  name: toDisplayName(slug),
  description,
  module,
  action: slug.split(':')[1] ?? slug,
});

const PERMISSIONS: PermissionSeed[] = [
  permission('auth:logout', 'Logout current session', 'user'),
  permission('auth:logout_all', 'Logout all sessions', 'user'),

  permission('user:read', 'View users', 'user'),
  permission('user:create', 'Create users', 'user'),
  permission('user:update', 'Update users', 'user'),
  permission('user:delete', 'Delete users', 'user'),
  permission('user:admin', 'Manage user roles and permissions', 'user'),
  permission('role:read', 'View roles', 'user'),
  permission('role:create', 'Create roles', 'user'),
  permission('role:update', 'Update roles', 'user'),
  permission('role:delete', 'Delete roles', 'user'),
  permission('role:assign', 'Assign roles to users', 'user'),
  permission('permission:read', 'View permissions', 'user'),

  permission('document:read', 'View documents', 'document'),
  permission('document:write', 'Upload and create documents', 'document'),
  permission('document:delete', 'Delete documents', 'document'),
  permission('document_template:read', 'View document templates', 'document'),
  permission('document_template:write', 'Create and update document templates', 'document'),
  permission('document_template:delete', 'Delete document templates', 'document'),

  permission('log:read', 'View audit logs', 'logging'),
  permission('log:summary', 'View audit log summary and aggregate stats', 'logging'),

  permission('notification:read', 'View notifications', 'messaging'),
  permission('notification:update', 'Mark notifications as read', 'messaging'),
  permission('notification_template:read', 'View notification templates', 'messaging'),
  permission('notification_template:write', 'Create and update notification templates', 'messaging'),
  permission('notification_template:delete', 'Delete notification templates', 'messaging'),
  permission('notification_queue:read', 'View notification queue stats', 'messaging'),

  permission('job:read', 'View background jobs', 'background'),
  permission('job:admin', 'Enable and disable background jobs', 'background'),

  permission('approval:read', 'View approvals', 'workflow'),
  permission('approval:approve', 'Approve approval steps', 'workflow'),
  permission('approval:reject', 'Reject approval steps', 'workflow'),
  permission('approval:cancel', 'Cancel approvals', 'workflow'),
  permission('assignment:read', 'View assignments', 'workflow'),
  permission('assignment:create', 'Create assignments', 'workflow'),
  permission('assignment:delete', 'Remove assignments', 'workflow'),
  permission('escalation:read', 'View escalations', 'workflow'),
  permission('escalation:acknowledge', 'Acknowledge escalations', 'workflow'),
  permission('escalation_policy:read', 'View escalation policies', 'workflow'),
  permission('escalation_policy:update', 'Update escalation policies', 'workflow'),

  permission('universe:read', 'View audit universe entities', 'audit'),
  permission('universe:create', 'Create audit universe entities', 'audit'),
  permission('universe:update', 'Update audit universe entities', 'audit'),
  permission('universe:delete', 'Delete audit universe entities', 'audit'),
  permission('plan:read', 'View audit plans', 'audit'),
  permission('plan:create', 'Create audit plans', 'audit'),
  permission('plan:update', 'Update audit plans', 'audit'),
  permission('plan:add_item', 'Add items to audit plans', 'audit'),
  permission('plan:submit', 'Submit audit plans for approval', 'audit'),
  permission('plan:approve', 'Approve audit plans', 'audit'),
  permission('plan:reject', 'Reject audit plans', 'audit'),
  permission('engagement:read', 'View audit engagements', 'audit'),
  permission('engagement:create', 'Create audit engagements', 'audit'),
  permission('engagement:update', 'Update audit engagements', 'audit'),
  permission('engagement:delete', 'Delete audit engagements', 'audit'),
  permission('checklist:read', 'View audit checklists', 'audit'),
  permission('checklist:update', 'Update checklist items', 'audit'),
  permission('working_paper:read', 'View working papers', 'audit'),
  permission('working_paper:create', 'Create working papers', 'audit'),
  permission('working_paper:update', 'Update working papers', 'audit'),
  permission('working_paper:submit', 'Submit working papers for review', 'audit'),
  permission('working_paper:approve', 'Approve working papers', 'audit'),
  permission('working_paper:reject', 'Reject working papers', 'audit'),
  permission('evidence:read', 'View evidence', 'audit'),
  permission('evidence:upload', 'Upload evidence', 'audit'),
  permission('evidence:dispute', 'Dispute evidence', 'audit'),
  permission('finding:read', 'View findings', 'audit'),
  permission('finding:create', 'Create findings', 'audit'),
  permission('finding:update', 'Update findings', 'audit'),
  permission('finding:close', 'Close findings', 'audit'),
  permission('followup:read', 'View follow-ups', 'audit'),
  permission('followup:respond', 'Submit management responses', 'audit'),
  permission('followup:evidence', 'Submit remediation evidence', 'audit'),
  permission('followup:verify', 'Verify remediation', 'audit'),
  permission('report:read', 'View audit reports', 'audit'),
  permission('report:create', 'Generate audit reports', 'audit'),
  permission('report:update', 'Update audit reports', 'audit'),
  permission('report:submit', 'Submit reports for approval', 'audit'),
  permission('report:approve', 'Approve audit reports', 'audit'),
  permission('report:reject', 'Reject audit reports', 'audit'),
  permission('report:issue', 'Issue audit reports', 'audit'),
  permission('report:export', 'Export audit reports', 'audit'),

  permission('risk_category:read', 'View risk categories', 'risk'),
  permission('risk_category:write', 'Create and update risk categories', 'risk'),
  permission('risk_category:delete', 'Delete risk categories', 'risk'),
  permission('risk:read', 'View risks', 'risk'),
  permission('risk:create', 'Create risks', 'risk'),
  permission('risk:update', 'Update risks', 'risk'),
  permission('risk:delete', 'Delete risks', 'risk'),
  permission('risk:assess', 'Assess risks', 'risk'),
  permission('risk_monitoring:read', 'View risk monitoring data', 'risk'),

  permission('dashboard:read', 'View dashboard data', 'dashboard'),

  permission('settings:read', 'View settings', 'settings'),
  permission('settings:manage', 'Manage system settings', 'settings'),
];

// ------------------------------------------------------------
// Roles + their permission sets
// ------------------------------------------------------------
const ROLES: Array<{
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
}> = [
  {
    name: 'super_admin',
    description: 'Full system access',
    isSystem: true,
    permissions: PERMISSIONS.map((p) => p.slug),
  },
  {
    name: 'audit_manager',
    description: 'Audit manager with audit programme, workflow, risk, document, and read-only settings access',
    isSystem: false,
    permissions: [
      'universe:read', 'universe:create', 'universe:update',
      'plan:read', 'plan:create', 'plan:update', 'plan:add_item', 'plan:submit', 'plan:approve', 'plan:reject',
      'engagement:read', 'engagement:create', 'engagement:update',
      'checklist:read', 'checklist:update',
      'working_paper:read', 'working_paper:create', 'working_paper:update', 'working_paper:submit', 'working_paper:approve', 'working_paper:reject',
      'evidence:read', 'evidence:upload', 'evidence:dispute',
      'finding:read', 'finding:create', 'finding:update', 'finding:close',
      'followup:read', 'followup:verify',
      'report:read', 'report:create', 'report:update', 'report:submit', 'report:approve', 'report:reject', 'report:issue', 'report:export',
      'risk:read', 'risk:create', 'risk:update', 'risk:assess',
      'risk_category:read', 'risk_category:write',
      'risk_monitoring:read',
      'approval:read', 'approval:approve', 'approval:reject', 'approval:cancel',
      'assignment:read', 'assignment:create', 'assignment:delete',
      'escalation:read', 'escalation:acknowledge',
      'escalation_policy:read', 'escalation_policy:update',
      'user:read', 'role:read',
      'document:read', 'document:write',
      'document_template:read',
      'dashboard:read',
      'notification:read', 'notification:update',
      'notification_template:read',
      'log:read',
      'job:read',
      'settings:read',
    ],
  },
  {
    name: 'audit_lead',
    description: 'Lead auditor who manages assigned engagement execution',
    isSystem: false,
    permissions: [
      'universe:read',
      'plan:read',
      'engagement:read', 'engagement:update',
      'checklist:read', 'checklist:update',
      'working_paper:read', 'working_paper:create', 'working_paper:update', 'working_paper:submit', 'working_paper:approve', 'working_paper:reject',
      'evidence:read', 'evidence:upload',
      'finding:read', 'finding:create', 'finding:update', 'finding:close',
      'followup:read', 'followup:verify',
      'report:read', 'report:export',
      'risk:read',
      'risk_monitoring:read',
      'approval:read',
      'assignment:read',
      'escalation:read',
      'document:read', 'document:write',
      'dashboard:read',
      'notification:read', 'notification:update',
      'log:read',
    ],
  },
  {
    name: 'auditor',
    description: 'Standard auditor who works on assigned engagements',
    isSystem: false,
    permissions: [
      'universe:read',
      'plan:read',
      'engagement:read',
      'checklist:read', 'checklist:update',
      'working_paper:read', 'working_paper:create', 'working_paper:update',
      'evidence:read', 'evidence:upload',
      'finding:read',
      'followup:read',
      'report:read',
      'document:read', 'document:write',
      'dashboard:read',
      'notification:read', 'notification:update',
    ],
  },
  {
    name: 'auditee',
    description: 'Auditee who views findings and submits follow-up responses',
    isSystem: false,
    permissions: [
      'engagement:read',
      'finding:read',
      'followup:read', 'followup:respond', 'followup:evidence',
      'notification:read', 'notification:update',
      'dashboard:read',
    ],
  },
  {
    name: 'director',
    description: 'Director with oversight and approval permissions',
    isSystem: false,
    permissions: [
      'engagement:read',
      'finding:read',
      'report:read',
      'approval:read', 'approval:approve', 'approval:reject',
      'risk:read',
      'risk_monitoring:read',
      'universe:read',
      'plan:read',
      'dashboard:read',
      'notification:read', 'notification:update',
      'log:read',
    ],
  },
  {
    name: 'cae',
    description: 'Chief Audit Executive with executive oversight and issue authority',
    isSystem: false,
    permissions: [
      'engagement:read',
      'finding:read',
      'report:read', 'report:issue',
      'approval:read', 'approval:approve', 'approval:reject',
      'risk:read', 'risk_monitoring:read',
      'universe:read',
      'plan:read', 'plan:approve', 'plan:reject',
      'dashboard:read',
      'notification:read', 'notification:update',
      'log:read', 'log:summary',
    ],
  },
  {
    name: 'viewer',
    description: 'Read-only access for oversight and default SSO provisioning',
    isSystem: false,
    permissions: [
      'engagement:read',
      'finding:read',
      'report:read',
      'risk:read',
      'risk_monitoring:read',
      'universe:read',
      'plan:read',
      'dashboard:read',
      'notification:read',
    ],
  },
];

type SeedUser = {
  email: string;
  legacyEmail?: string;
  password: string;
  firstName: string;
  lastName: string;
  department: string;
  jobTitle: string;
  roles: string[];
  isSystemUser?: boolean;
};

const SEEDED_USERS: SeedUser[] = [
  {
    email: 'admin@example.com',
    password: 'Bello@123456!',
    firstName: 'Bello',
    lastName: 'Adesanya',
    department: 'Internal Audit',
    jobTitle: 'Chief Audit Executive',
    roles: ['super_admin'],
    isSystemUser: true,
  },
  {
    email: 'adaeze@gbb.gov.ng',
    password: 'Adaeze@123456!',
    firstName: 'Adaeze',
    lastName: 'Okonkwo',
    department: 'Internal Audit',
    jobTitle: 'Audit Manager',
    roles: ['audit_manager'],
  },
  {
    email: 'tunde@gbb.gov.ng',
    legacyEmail: 'auditor@gbb.gov.ng',
    password: 'Tunde@123456!',
    firstName: 'Tunde',
    lastName: 'Bakare',
    department: 'Internal Audit',
    jobTitle: 'Lead Auditor',
    roles: ['audit_lead'],
  },
  {
    email: 'chisom@gbb.gov.ng',
    legacyEmail: 'auditee@gbb.gov.ng',
    password: 'Chisom@123456!',
    firstName: 'Chisom',
    lastName: 'Okafor',
    department: 'Finance',
    jobTitle: 'Head of Finance',
    roles: ['auditee'],
  },
  {
    email: 'ibrahim@gbb.gov.ng',
    legacyEmail: 'director@gbb.gov.ng',
    password: 'Ibrahim@123456!',
    firstName: 'Ibrahim',
    lastName: 'Musa',
    department: 'Executive',
    jobTitle: 'Director',
    roles: ['director'],
  },
  {
    email: 'fatima@gbb.gov.ng',
    legacyEmail: 'cae@gbb.gov.ng',
    password: 'Fatima@123456!',
    firstName: 'Fatima',
    lastName: 'Aliyu',
    department: 'Executive',
    jobTitle: 'Chief Audit Executive',
    roles: ['cae'],
  },
  {
    email: 'emeka@gbb.gov.ng',
    password: 'Emeka@123456!',
    firstName: 'Emeka',
    lastName: 'Eze',
    department: 'Internal Audit',
    jobTitle: 'Staff Auditor',
    roles: ['auditor'],
  },
];

// ─────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  logger.info('Seeding database');

  // 1. Upsert permissions and remove obsolete catalogue entries.
  const permissionSlugs = PERMISSIONS.map((perm) => perm.slug);

  await prisma.role_Permission.deleteMany({
    where: { permission: { slug: { notIn: permissionSlugs } } },
  });
  await prisma.permission.deleteMany({
    where: { slug: { notIn: permissionSlugs } },
  });

  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { slug: perm.slug },
      create: perm,
      update: {
        name: perm.name,
        module: perm.module,
        action: perm.action,
        description: perm.description,
      },
    });
  }
  logger.info('Permissions seeded', { count: PERMISSIONS.length });

  // 2. Upsert roles + role_permissions.
  for (const roleData of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleData.name },
      create: {
        name: roleData.name,
        description: roleData.description,
        is_system: roleData.isSystem,
      },
      update: {
        description: roleData.description,
        is_system: roleData.isSystem,
      },
    });

    await prisma.role_Permission.deleteMany({ where: { role_id: role.id } });

    const permissions = await prisma.permission.findMany({
      where: { slug: { in: roleData.permissions } },
      select: { id: true, slug: true },
    });

    if (permissions.length !== roleData.permissions.length) {
      const foundSlugs = new Set(permissions.map((perm) => perm.slug));
      const missingSlugs = roleData.permissions.filter((slug) => !foundSlugs.has(slug));
      throw AppError.internal(
        'Seed role ' + roleData.name + ' references missing permissions: ' + missingSlugs.join(', '),
      );
    }

    await prisma.role_Permission.createMany({
      data: permissions.map((perm) => ({ role_id: role.id, permission_id: perm.id })),
    });
  }
  logger.info('Roles seeded', { count: ROLES.length });

  // 3. Upsert seed users + role assignments.
  let adminUserId = '';
  for (const seedUser of SEEDED_USERS) {
    const displayName = seedUser.firstName + ' ' + seedUser.lastName;
    const passwordHash = await bcrypt.hash(seedUser.password, 12);
    const seedUserIsSuperAdmin = seedUser.roles.includes('super_admin');

    if (seedUser.legacyEmail) {
      const existingTarget = await prisma.user.findUnique({
        where: { email: seedUser.email },
      });
      const existingLegacy = await prisma.user.findUnique({
        where: { email: seedUser.legacyEmail },
      });

      if (!existingTarget && existingLegacy) {
        await prisma.user.update({
          where: { id: existingLegacy.id },
          data: { email: seedUser.email },
        });
      }
    }

    const user = await prisma.user.upsert({
      where: { email: seedUser.email },
      create: {
        email: seedUser.email,
        first_name: seedUser.firstName,
        last_name: seedUser.lastName,
        display_name: displayName,
        password_hash: passwordHash,
        department: seedUser.department,
        job_title: seedUser.jobTitle,
        email_verified: true,
        is_system_user: seedUser.isSystemUser ?? false,
        is_super_admin: seedUserIsSuperAdmin,
        is_active: true,
      },
      update: {
        first_name: seedUser.firstName,
        last_name: seedUser.lastName,
        display_name: displayName,
        password_hash: passwordHash,
        department: seedUser.department,
        job_title: seedUser.jobTitle,
        email_verified: true,
        is_system_user: seedUser.isSystemUser ?? false,
        is_super_admin: seedUserIsSuperAdmin,
        is_active: true,
        deleted_at: null,
      },
    });
    const roles = await prisma.role.findMany({
      where: { name: { in: seedUser.roles } },
      select: { id: true, name: true },
    });

    await prisma.user_Role.deleteMany({ where: { user_id: user.id } });
    await prisma.user_Role.createMany({
      data: roles.map((role) => ({ user_id: user.id, role_id: role.id })),
    });

    if (seedUser.email === 'admin@example.com') {
      adminUserId = user.id;
    }
    logger.info('User seeded', {
      email: seedUser.email,
      roles: roles.map((role) => role.name),
    });
  }

  // 4. Upsert default DOCX export templates.
  for (const tpl of DOCUMENT_TEMPLATES) {
    const existing = await prisma.document_Template.findUnique({
      where: { name: tpl.name },
    });
    if (existing) {
      await prisma.document_Template.update({
        where: { id: existing.id },
        data: {
          description: tpl.description,
          category: tpl.category,
          content: tpl.content,
          is_active: true,
          deleted_at: null,
          updated_by_id: adminUserId,
        },
      });
    } else {
      await prisma.document_Template.create({
        data: {
          name: tpl.name,
          description: tpl.description,
          category: tpl.category,
          content: tpl.content,
          is_active: true,
          created_by_id: adminUserId,
        },
      });
    }
  }
  logger.info('Document templates seeded', { count: DOCUMENT_TEMPLATES.length });

  // 5. Upsert default notification templates (event_key + channel is unique).
  for (const tpl of NOTIFICATION_TEMPLATES) {
    await prisma.notification_Template.upsert({
      where: {
        event_key_channel: { event_key: tpl.eventKey, channel: tpl.channel },
      },
      create: {
        event_key: tpl.eventKey,
        channel: tpl.channel,
        name: tpl.name,
        subject: tpl.subject,
        body: tpl.body,
        description: tpl.description,
        is_active: true,
        created_by_id: adminUserId,
      },
      update: {
        name: tpl.name,
        subject: tpl.subject,
        body: tpl.body,
        description: tpl.description,
        is_active: true,
        deleted_at: null,
        updated_by_id: adminUserId,
      },
    });
  }
  logger.info('Notification templates seeded', { count: NOTIFICATION_TEMPLATES.length });

  logger.info('Seed complete');
}

main()
  .catch((err: unknown) => {
    logger.error('Seed failed', { err });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
