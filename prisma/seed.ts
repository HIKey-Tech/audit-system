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

  // audit.finding.overdue
  {
    eventKey: 'audit.finding.overdue',
    channel: 'email',
    name: 'Finding Remediation Due — Email',
    subject: 'Finding {{statusLabel}}: {{findingTitle}}',
    body: 'Dear {{recipientName}},\n\nThe following audit finding requires attention.\n\nFinding: {{findingTitle}}\nEngagement: {{engagementReference}}\nSeverity: {{severity}}\nStatus: {{statusLabel}}\nDue date: {{dueDate}}\n\nPlease log in to IAMS to action the remediation.\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Sent to the auditee and lead auditor when a finding is approaching or past its remediation due date. Variables: recipientName, findingTitle, engagementReference, severity, statusLabel, dueDate.',
  },
  {
    eventKey: 'audit.finding.overdue',
    channel: 'in_app',
    name: 'Finding Remediation Due — In-App',
    subject: null,
    body: "Finding '{{findingTitle}}' ({{engagementReference}}) is {{statusLabel}}.",
    description:
      'In-app variant of finding-overdue notification. Variables: findingTitle, engagementReference, statusLabel.',
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

  // user.mfa.grace_reminder
  {
    eventKey: 'user.mfa.grace_reminder',
    channel: 'email',
    name: 'MFA Grace Reminder — Email',
    subject: 'Action required: set up two-factor authentication',
    body: 'Dear {{recipientName}},\n\nYour IAMS account requires two-factor authentication. You have {{daysRemaining}} day(s) left before this is enforced at login (deadline: {{graceDeadline}}).\n\nPlease log in to IAMS and complete 2FA setup from your profile.\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Warns a not-yet-enrolled user before their mandatory-2FA grace period ends. Variables: recipientName, daysRemaining, graceDeadline.',
  },
  {
    eventKey: 'user.mfa.grace_reminder',
    channel: 'in_app',
    name: 'MFA Grace Reminder — In-App',
    subject: null,
    body: 'Two-factor authentication setup is required within {{daysRemaining}} day(s), or you will be locked out until you enroll.',
    description:
      'In-app variant of the MFA grace reminder. Variables: daysRemaining, graceDeadline.',
  },

  // risk.reassessment.suggested
  {
    eventKey: 'risk.reassessment.suggested',
    channel: 'email',
    name: 'Risk Reassessment Suggested — Email',
    subject: 'Risk reassessment suggested: {{riskTitle}}',
    body: 'Dear {{ownerName}},\n\nAudit finding "{{findingTitle}}" affecting {{entityName}} has been verified.\n\nAs the owner of risk "{{riskTitle}}", please review whether this outcome changes the risk\'s likelihood or impact, and record a new assessment in the risk register if so.\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Nudges a risk owner to reassess after a related audit finding is verified. Variables: ownerName, riskTitle, findingTitle, entityName.',
  },
  {
    eventKey: 'risk.reassessment.suggested',
    channel: 'in_app',
    name: 'Risk Reassessment Suggested — In-App',
    subject: null,
    body: 'Finding "{{findingTitle}}" affecting {{entityName}} was verified — consider reassessing risk "{{riskTitle}}".',
    description:
      'In-app variant of the risk reassessment suggestion. Variables: findingTitle, entityName, riskTitle.',
  },

  // workflow.request.created (also reused when a chain advances to the next recipient)
  {
    eventKey: 'workflow.request.created',
    channel: 'email',
    name: 'Request Awaiting Action — Email',
    subject: 'Action Required: Request {{requestReference}}',
    body: 'Dear {{recipientName}},\n\n{{initiatorName}} has sent you a request that needs your action.\n\nTitle: {{requestTitle}}\nReference: {{requestReference}}\n\nPlease log in to IAMS to approve, sign, reject, or comment.\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Sent to the current recipient when a request is created or advances to them. Variables: recipientName, initiatorName, requestTitle, requestReference.',
  },
  {
    eventKey: 'workflow.request.created',
    channel: 'in_app',
    name: 'Request Awaiting Action — In-App',
    subject: null,
    body: '{{initiatorName}} sent you a request "{{requestTitle}}" ({{requestReference}}) that needs your action.',
    description:
      'In-app variant of request-awaiting-action. Variables: initiatorName, requestTitle, requestReference.',
  },

  // workflow.request.completed
  {
    eventKey: 'workflow.request.completed',
    channel: 'email',
    name: 'Request Completed — Email',
    subject: 'Completed: Request {{requestReference}}',
    body: 'Dear {{recipientName}},\n\nYour request "{{requestTitle}}" ({{requestReference}}) has completed all steps.\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Sent to the initiator when all recipients have acted. Variables: recipientName, requestTitle, requestReference.',
  },
  {
    eventKey: 'workflow.request.completed',
    channel: 'in_app',
    name: 'Request Completed — In-App',
    subject: null,
    body: 'Your request "{{requestTitle}}" ({{requestReference}}) has completed all steps.',
    description:
      'In-app variant of request-completed. Variables: requestTitle, requestReference.',
  },

  // workflow.request.rejected
  {
    eventKey: 'workflow.request.rejected',
    channel: 'email',
    name: 'Request Rejected — Email',
    subject: 'Rejected: Request {{requestReference}}',
    body: 'Dear {{recipientName}},\n\nYour request "{{requestTitle}}" ({{requestReference}}) was rejected by {{actorName}}.\n\nReason: {{rejectionReason}}\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Sent to the initiator when a recipient rejects. Variables: recipientName, requestTitle, requestReference, actorName, rejectionReason.',
  },
  {
    eventKey: 'workflow.request.rejected',
    channel: 'in_app',
    name: 'Request Rejected — In-App',
    subject: null,
    body: 'Your request "{{requestTitle}}" ({{requestReference}}) was rejected by {{actorName}}. Reason: {{rejectionReason}}',
    description:
      'In-app variant of request-rejected. Variables: requestTitle, requestReference, actorName, rejectionReason.',
  },

  // workflow.request.commented
  {
    eventKey: 'workflow.request.commented',
    channel: 'email',
    name: 'Request Comment — Email',
    subject: 'New comment on Request {{requestReference}}',
    body: 'Dear {{recipientName}},\n\n{{actorName}} commented on the request "{{requestTitle}}" ({{requestReference}}).\n\nPlease log in to IAMS to view the comment.\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Sent to the initiator and current recipient when a comment is added. Variables: recipientName, actorName, requestTitle, requestReference.',
  },
  {
    eventKey: 'workflow.request.commented',
    channel: 'in_app',
    name: 'Request Comment — In-App',
    subject: null,
    body: '{{actorName}} commented on the request "{{requestTitle}}" ({{requestReference}}).',
    description:
      'In-app variant of request-comment. Variables: actorName, requestTitle, requestReference.',
  },

  // workflow.request.cancelled
  {
    eventKey: 'workflow.request.cancelled',
    channel: 'email',
    name: 'Request Cancelled — Email',
    subject: 'Cancelled: Request {{requestReference}}',
    body: 'Dear {{recipientName}},\n\nThe request "{{requestTitle}}" ({{requestReference}}) has been cancelled.\n\nRegards,\nIAMS — Internal Audit System',
    description:
      'Sent to the current recipient when the initiator cancels. Variables: recipientName, requestTitle, requestReference.',
  },
  {
    eventKey: 'workflow.request.cancelled',
    channel: 'in_app',
    name: 'Request Cancelled — In-App',
    subject: null,
    body: 'The request "{{requestTitle}}" ({{requestReference}}) has been cancelled.',
    description:
      'In-app variant of request-cancelled. Variables: requestTitle, requestReference.',
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

export const PERMISSIONS: PermissionSeed[] = [
  permission('auth:logout', 'Logout current session', 'user'),
  permission('auth:logout_all', 'Logout all sessions', 'user'),

  permission('user:read', 'View users', 'user'),
  permission('user:directory', 'Look up the basic staff directory for assignment pickers', 'user'),
  permission('user:create', 'Create users', 'user'),
  permission('user:update', 'Update users', 'user'),
  permission('user:deactivate', 'Activate and deactivate users', 'user'),
  permission('user:delete', 'Delete users', 'user'),
  permission('user:admin', 'Manage user roles and permissions', 'user'),
  permission('user:reset_2fa', "Reset a user's two-factor authentication (lockout recovery)", 'user'),
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
  permission('request:create', 'Initiate ad-hoc workflow requests', 'workflow'),
  permission('request:read', 'View ad-hoc workflow requests', 'workflow'),
  permission('request:receive', 'Be eligible as a request recipient', 'workflow'),
  permission('request:act', 'Approve, sign, reject, or comment on requests', 'workflow'),
  permission('request:admin', 'Administer and cancel any request', 'workflow'),

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
  permission('checklist:create', 'Add audit checklist items', 'audit'),
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
  permission('evidence:request', 'Request evidence from auditees', 'audit'),
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
  permission('report:approve:oversight', 'Designated oversight sign-off in the audit report approval chain', 'audit'),
  permission('report:approve:final', 'Designated final executive sign-off in the audit report approval chain', 'audit'),
  permission('report:reject', 'Reject audit reports', 'audit'),
  permission('report:issue', 'Issue audit reports', 'audit'),
  permission('report:export', 'Export audit reports', 'audit'),

  permission('control:read', 'View compliance frameworks and controls', 'audit'),
  permission('control:manage', 'Create, update, and retire compliance frameworks and controls', 'audit'),

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
  permission('committee_pack:read', 'View and export the audit committee pack', 'dashboard'),

  permission('asset:read', 'View asset registry records', 'asset'),
  permission('asset:create', 'Create asset registry records', 'asset'),
  permission('asset:update', 'Update asset registry records', 'asset'),
  permission('asset:delete', 'Delete asset registry records', 'asset'),
  permission('asset:admin', 'Administer asset classification, lifecycle, and source records', 'asset'),
  permission('asset:attest', 'Attest assigned asset ownership and accuracy', 'asset'),
  permission('asset:import', 'Import asset records from approved read-only sources', 'asset'),
  permission('asset:link', 'Link assets to audit universe, engagements, findings, risks, and evidence', 'asset'),
  permission('asset:export', 'Export asset registry records', 'asset'),

  permission('integration:read', 'View integration status and configuration', 'integration'),
  permission('predictive:read', 'View predictive analytics insights', 'predictive'),

  permission('settings:read', 'View settings', 'settings'),
  permission('settings:manage', 'Manage system settings', 'settings'),
  permission('report_template:manage', 'Create and manage audit report templates', 'settings'),

  permission('engagement:read_all', 'View all audit engagements', 'audit'),
  permission('finding:read_all', 'View all findings', 'audit'),
  permission('risk:read_all', 'View all risks in the organization', 'risk'),
];

// ------------------------------------------------------------
// Roles + their permission sets
// ------------------------------------------------------------
export const ROLES: Array<{
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
      'plan:read', 'plan:create', 'plan:update', 'plan:add_item', 'plan:submit',
      'engagement:read', 'engagement:create', 'engagement:update', 'engagement:read_all',
      'checklist:read', 'checklist:create', 'checklist:update',
      'working_paper:read', 'working_paper:create', 'working_paper:update', 'working_paper:submit', 'working_paper:approve', 'working_paper:reject',
      'evidence:read', 'evidence:upload', 'evidence:dispute', 'evidence:request',
      'finding:read', 'finding:create', 'finding:update', 'finding:close', 'finding:read_all',
      'followup:read', 'followup:verify',
      'report:read', 'report:create', 'report:update', 'report:submit', 'report:approve', 'report:reject', 'report:issue', 'report:export',
      'control:read', 'control:manage',
      'risk:read', 'risk:create', 'risk:update', 'risk:assess', 'risk:read_all',
      'risk_category:read', 'risk_category:write',
      'risk_monitoring:read',
      'asset:read', 'asset:create', 'asset:update', 'asset:delete', 'asset:admin', 'asset:attest', 'asset:import', 'asset:link', 'asset:export',
      'integration:read',
      'predictive:read',
      'approval:read', 'approval:approve', 'approval:reject', 'approval:cancel',
      'assignment:read', 'assignment:create', 'assignment:delete',
      'escalation:read', 'escalation:acknowledge',
      'escalation_policy:read', 'escalation_policy:update',
      'user:read', 'user:directory', 'role:read',
      'document:read', 'document:write',
      'document_template:read',
      'dashboard:read',
      'notification:read', 'notification:update',
      'notification_template:read',
      'log:read',
      'job:read',
      'settings:read',
      'request:create', 'request:read', 'request:receive', 'request:act', 'request:admin',
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
      'checklist:read', 'checklist:create', 'checklist:update',
      'working_paper:read', 'working_paper:create', 'working_paper:update', 'working_paper:submit', 'working_paper:approve', 'working_paper:reject',
      'evidence:read', 'evidence:upload', 'evidence:request',
      'finding:read', 'finding:create', 'finding:update', 'finding:close',
      'followup:read', 'followup:verify',
      'user:directory',
      'report:read', 'report:export', 'report:approve',
      'control:read',
      'risk:read',
      'risk_monitoring:read',
      'asset:read', 'asset:link', 'asset:attest', 'asset:export',
      'approval:read', 'approval:approve', 'approval:reject',
      'assignment:read',
      'escalation:read',
      'document:read', 'document:write',
      'dashboard:read',
      'notification:read', 'notification:update',
      'log:read',
      'request:create', 'request:read', 'request:receive', 'request:act',
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
      'checklist:read', 'checklist:create', 'checklist:update',
      'working_paper:read', 'working_paper:create', 'working_paper:update', 'working_paper:submit',
      'evidence:read', 'evidence:upload', 'evidence:request',
      'finding:read', 'finding:create', 'finding:update',
      'followup:read',
      'user:directory',
      'report:read',
      'asset:read', 'asset:link',
      'document:read', 'document:write',
      'dashboard:read',
      'notification:read', 'notification:update',
      'request:create', 'request:read', 'request:receive', 'request:act',
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
      'asset:read', 'asset:attest',
      'notification:read', 'notification:update',
      'dashboard:read',
      'request:create', 'request:read', 'request:receive', 'request:act',
    ],
  },
  {
    name: 'director',
    description: 'Director with oversight and approval permissions',
    isSystem: false,
    permissions: [
      'engagement:read', 'engagement:read_all',
      'finding:read', 'finding:read_all',
      'report:read', 'report:approve:oversight',
      'committee_pack:read',
      'approval:read', 'approval:approve', 'approval:reject',
      'risk:read', 'risk:read_all',
      'risk_monitoring:read',
      'asset:read', 'asset:export',
      'integration:read',
      'predictive:read',
      'universe:read',
      'plan:read',
      'dashboard:read',
      'notification:read', 'notification:update',
      'log:read',
      'request:create', 'request:read', 'request:receive', 'request:act',
    ],
  },
  {
    name: 'cae',
    description: 'Chief Audit Executive with executive oversight and issue authority',
    isSystem: false,
    permissions: [
      'engagement:read', 'engagement:read_all',
      'finding:read', 'finding:read_all',
      'report:read', 'report:issue', 'report:approve:final',
      'committee_pack:read',
      'approval:read', 'approval:approve', 'approval:reject',
      'risk:read', 'risk:read_all',
      'risk_monitoring:read',
      'asset:read', 'asset:export',
      'integration:read',
      'predictive:read',
      'universe:read',
      'plan:read', 'plan:approve', 'plan:reject',
      'dashboard:read',
      'notification:read', 'notification:update',
      'log:read', 'log:summary',
      'request:create', 'request:read', 'request:receive', 'request:act',
    ],
  },
  {
    // Access is the permission slug, not this role: any GBB-defined role
    // granted committee_pack:read can view/export the pack.
    name: 'audit_committee',
    description: 'Audit committee member — periodic oversight pack access only',
    isSystem: false,
    permissions: [
      'committee_pack:read',
      'dashboard:read',
      'notification:read', 'notification:update',
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
      'asset:read',
      'integration:read',
      'predictive:read',
      'universe:read',
      'plan:read',
      'dashboard:read',
      'notification:read',
    ],
  },
];

// ------------------------------------------------------------
// Settings templates and system configuration
// ------------------------------------------------------------
type WorkingPaperSectionSeed = {
  title: string;
  description: string;
  placeholder: string;
  required: boolean;
};

type ReportSectionSeed = {
  key: string;
  title: string;
  description: string;
  include_findings: boolean;
};

type ReportVariableSeed = {
  key: string;
  description: string;
  example: string;
};

const WORKING_PAPER_TEMPLATES: Array<{
  name: string;
  description: string;
  auditType: string;
  isDefault: boolean;
  sections: WorkingPaperSectionSeed[];
}> = [
  {
    name: 'Standard Financial Audit Working Paper',
    description: 'Default working paper structure for financial audit procedures.',
    auditType: 'financial',
    isDefault: true,
    sections: [
      { title: 'Audit Objective', description: 'State the specific objective of this working paper', placeholder: 'Describe what this working paper aims to test or verify...', required: true },
      { title: 'Scope', description: 'Define the scope of testing for this working paper', placeholder: 'Define the transactions, periods, accounts, or systems covered...', required: true },
      { title: 'Test Procedure', description: 'Describe the testing steps performed', placeholder: 'List the steps taken to test the control or transaction...', required: true },
      { title: 'Sample Selection', description: 'Document the sample size and selection methodology', placeholder: 'Describe how the sample was selected and the sample size...', required: false },
      { title: 'Observations', description: 'Record findings and observations from testing', placeholder: 'Document what was observed during testing, including any exceptions...', required: true },
      { title: 'Conclusion', description: 'State the conclusion based on testing results', placeholder: 'Based on the testing performed, conclude whether the control is operating effectively...', required: true },
    ],
  },
  {
    name: 'Standard IT Audit Working Paper',
    description: 'Default working paper structure for IT audit procedures.',
    auditType: 'it',
    isDefault: true,
    sections: [
      { title: 'Control Objective', description: 'State the IT control objective being tested', placeholder: 'Describe the control objective from the applicable framework (ISO 27001, etc)...', required: true },
      { title: 'Control Description', description: 'Describe the control being tested', placeholder: 'Describe how the control is designed to operate...', required: true },
      { title: 'Test Procedure', description: 'Describe the testing steps performed', placeholder: 'List the steps taken to test the control...', required: true },
      { title: 'Evidence Reviewed', description: 'List all evidence reviewed during testing', placeholder: 'List the documents, logs, screenshots, or configurations reviewed...', required: true },
      { title: 'Exceptions Noted', description: 'Document any exceptions or control failures identified', placeholder: 'List any instances where the control was not operating as designed...', required: false },
      { title: 'Risk Rating', description: 'Assess the risk rating of any exceptions found', placeholder: 'If exceptions were noted, rate the risk as Critical, High, Medium, or Low...', required: false },
      { title: 'Conclusion', description: 'State the conclusion based on testing', placeholder: 'Conclude whether the control is operating effectively...', required: true },
    ],
  },
  {
    name: 'Standard Compliance Audit Working Paper',
    description: 'Default working paper structure for compliance audit procedures.',
    auditType: 'compliance',
    isDefault: true,
    sections: [
      { title: 'Regulatory Requirement', description: 'State the specific regulation or standard being tested', placeholder: 'Cite the specific section of the regulation or standard...', required: true },
      { title: 'Compliance Criteria', description: 'Define what constitutes compliance', placeholder: 'Describe the criteria that must be met to be compliant...', required: true },
      { title: 'Test Procedure', description: 'Describe the testing steps', placeholder: 'List the steps taken to assess compliance...', required: true },
      { title: 'Evidence Reviewed', description: 'List evidence reviewed', placeholder: 'List the policies, procedures, records, or systems reviewed...', required: true },
      { title: 'Compliance Status', description: 'State whether the requirement is met', placeholder: 'State Compliant, Partially Compliant, or Non-Compliant and explain...', required: true },
      { title: 'Conclusion', description: 'Overall conclusion', placeholder: 'Summarise the compliance position...', required: true },
    ],
  },
  {
    name: 'Standard Systems Audit Working Paper',
    description: 'Default working paper structure for systems audit procedures.',
    auditType: 'systems',
    isDefault: true,
    sections: [
      { title: 'System Overview', description: 'Describe the system being audited', placeholder: 'Describe the system, its purpose, and its criticality to GBB operations...', required: true },
      { title: 'Audit Objective', description: 'State the objective', placeholder: 'Describe what aspect of the system is being reviewed...', required: true },
      { title: 'Test Procedure', description: 'Describe testing steps', placeholder: 'List the technical steps performed to assess the system...', required: true },
      { title: 'Technical Findings', description: 'Document technical observations', placeholder: 'Document any technical issues, vulnerabilities, or weaknesses identified...', required: false },
      { title: 'Impact Assessment', description: 'Assess the impact of findings', placeholder: 'Describe the potential impact of any findings on GBB operations...', required: false },
      { title: 'Conclusion', description: 'Overall conclusion', placeholder: "Conclude on the system's control environment...", required: true },
    ],
  },
  {
    name: 'GBB General Audit Working Paper',
    description: 'Reusable working paper for standard internal audit testing across audit types.',
    auditType: 'all',
    isDefault: true,
    sections: [
      { title: 'Working Paper Reference', description: 'Record the working paper number and cross-reference', placeholder: 'WP-01 / linked checklist item / evidence reference...', required: true },
      { title: 'Objective', description: 'State the purpose of this work paper', placeholder: 'Describe the audit objective this work paper supports...', required: true },
      { title: 'Risk Addressed', description: 'Describe the risk or control objective being addressed', placeholder: 'Summarise the risk, control objective, or audit criterion...', required: true },
      { title: 'Procedure Performed', description: 'Document the work performed by the auditor', placeholder: 'Describe walkthroughs, inspection, reperformance, inquiry, observation, or analysis performed...', required: true },
      { title: 'Evidence Reference', description: 'List evidence reviewed and file references', placeholder: 'Document evidence IDs, filenames, screenshots, reports, or source systems reviewed...', required: true },
      { title: 'Results', description: 'Record the factual result of the procedure', placeholder: 'State what was found, including exceptions or no-exception results...', required: true },
      { title: 'Conclusion', description: 'State the auditor conclusion', placeholder: 'Conclude whether the objective was achieved and whether a finding is required...', required: true },
      { title: 'Reviewer Notes', description: 'Space for supervisory review comments', placeholder: 'Reviewer comments, clearance notes, and follow-up questions...', required: false },
    ],
  },
  {
    name: 'Walkthrough Working Paper',
    description: 'Documents process walkthroughs, control understanding, and design assessment.',
    auditType: 'all',
    isDefault: false,
    sections: [
      { title: 'Process Walked Through', description: 'Name the process and period covered', placeholder: 'Process name, owner, date, location, and period covered...', required: true },
      { title: 'Participants', description: 'List process owners and staff interviewed', placeholder: 'Names, roles, departments, and interview dates...', required: true },
      { title: 'Process Narrative', description: 'Describe the process flow end to end', placeholder: 'Document initiation, approvals, processing, controls, exceptions, and outputs...', required: true },
      { title: 'Key Controls Identified', description: 'List controls identified during the walkthrough', placeholder: 'Control owner, frequency, evidence, system/manual nature...', required: true },
      { title: 'Design Gaps', description: 'Record weaknesses in control design', placeholder: 'Describe missing controls, segregation issues, unclear accountability, or documentation gaps...', required: false },
      { title: 'Conclusion', description: 'Conclude on process understanding and design adequacy', placeholder: 'State whether controls are suitably designed for testing...', required: true },
    ],
  },
  {
    name: 'Control Test Working Paper',
    description: 'Documents operating effectiveness testing for a specific control.',
    auditType: 'all',
    isDefault: false,
    sections: [
      { title: 'Control Tested', description: 'Identify the control and owner', placeholder: 'Control ID, owner, frequency, system/manual, preventive/detective...', required: true },
      { title: 'Population', description: 'Define the population used for testing', placeholder: 'Source report, period, total population, completeness check...', required: true },
      { title: 'Sample Selection', description: 'Document sample size and selection method', placeholder: 'Random/judgmental/stratified sample, sample count, selection rationale...', required: true },
      { title: 'Test Steps', description: 'List the test procedures performed', placeholder: 'Inspection, reperformance, evidence matching, approval verification...', required: true },
      { title: 'Exceptions', description: 'Record exceptions and exception rate', placeholder: 'Exception details, affected samples, root cause, value/impact...', required: false },
      { title: 'Conclusion', description: 'Conclude on operating effectiveness', placeholder: 'Effective / partially effective / ineffective, with rationale...', required: true },
    ],
  },
  {
    name: 'Sampling Worksheet',
    description: 'Documents population validation and sample selection for audit testing.',
    auditType: 'all',
    isDefault: false,
    sections: [
      { title: 'Population Source', description: 'Identify the system/report used as population', placeholder: 'System name, report name, extraction date, period, owner...', required: true },
      { title: 'Completeness Check', description: 'Describe how the population was validated', placeholder: 'Record totals, reconciliations, tie-outs, duplicate checks, exclusions...', required: true },
      { title: 'Sampling Method', description: 'State the sampling method and rationale', placeholder: 'Random, judgmental, monetary unit, stratified, full population...', required: true },
      { title: 'Sample Details', description: 'List sample identifiers or attach evidence reference', placeholder: 'Sample IDs, transaction numbers, dates, values, evidence reference...', required: true },
      { title: 'Limitations', description: 'Document any population or sampling limitations', placeholder: 'Data quality issues, unavailable fields, exclusions, management constraints...', required: false },
      { title: 'Conclusion', description: 'Conclude whether the sample is appropriate', placeholder: 'State whether sample supports the planned testing objective...', required: true },
    ],
  },
  {
    name: 'ITGC Test Working Paper',
    description: 'Documents IT general control testing for access, change, operations, and backup controls.',
    auditType: 'it',
    isDefault: false,
    sections: [
      { title: 'ITGC Domain', description: 'Identify the ITGC domain being tested', placeholder: 'User access, privileged access, change management, job monitoring, backup/restore...', required: true },
      { title: 'System In Scope', description: 'Describe the application, database, or infrastructure component', placeholder: 'System name, owner, business purpose, hosting model, criticality...', required: true },
      { title: 'Control Objective', description: 'State the expected control objective', placeholder: 'Describe the security, availability, integrity, or confidentiality objective...', required: true },
      { title: 'Evidence Reviewed', description: 'List technical evidence reviewed', placeholder: 'Access listings, change tickets, logs, screenshots, configuration exports...', required: true },
      { title: 'Testing Result', description: 'Document testing result and exceptions', placeholder: 'Pass/fail result, exceptions, affected users/changes/jobs, risk impact...', required: true },
      { title: 'Conclusion', description: 'Conclude on control effectiveness', placeholder: 'State whether the ITGC is designed and operating effectively...', required: true },
    ],
  },
  {
    name: 'Finding Validation Working Paper',
    description: 'Documents validation of a potential audit finding before it is raised formally.',
    auditType: 'all',
    isDefault: false,
    sections: [
      { title: 'Condition', description: 'Describe what was found', placeholder: 'Factual condition supported by evidence...', required: true },
      { title: 'Criteria', description: 'Document the expected policy, standard, regulation, or control', placeholder: 'Policy clause, ISO/COBIT/NIST/PCI requirement, procedure, SLA...', required: true },
      { title: 'Cause', description: 'Assess why the condition occurred', placeholder: 'Process gap, control failure, system limitation, oversight, resource issue...', required: true },
      { title: 'Effect/Risk', description: 'Describe the impact or exposure', placeholder: 'Operational, financial, compliance, security, reputational, or service impact...', required: true },
      { title: 'Recommendation', description: 'Propose corrective action', placeholder: 'Specific, practical recommendation and responsible owner...', required: true },
      { title: 'Management Discussion', description: 'Document discussion with the auditee', placeholder: 'Date discussed, participants, agreement/disagreement, clarification received...', required: false },
    ],
  },
  {
    name: 'Follow-up Verification Working Paper',
    description: 'Documents validation that management actions have remediated an issued finding.',
    auditType: 'all',
    isDefault: false,
    sections: [
      { title: 'Finding Reference', description: 'Identify the finding being followed up', placeholder: 'Finding ID, report reference, severity, original due date...', required: true },
      { title: 'Management Action', description: 'Summarise the agreed management action', placeholder: 'Action owner, commitment, due date, response summary...', required: true },
      { title: 'Evidence Received', description: 'List remediation evidence reviewed', placeholder: 'Evidence files, system records, screenshots, policies, tickets...', required: true },
      { title: 'Verification Procedure', description: 'Document follow-up testing performed', placeholder: 'Inspection, reperformance, inquiry, observation, sample retest...', required: true },
      { title: 'Verification Result', description: 'State whether remediation is adequate', placeholder: 'Verified / partially verified / rejected, with rationale...', required: true },
      { title: 'Residual Risk', description: 'Document any remaining exposure', placeholder: 'Residual issue, further action required, revised due date...', required: false },
    ],
  },
];

const REPORT_TEMPLATES: Array<{
  name: string;
  description: string;
  isDefault: boolean;
  sections: ReportSectionSeed[];
  availableVariables: ReportVariableSeed[];
  headerConfig: Record<string, unknown>;
  footerConfig: Record<string, unknown>;
  signatureConfig: Record<string, unknown>;
}> = [
  {
    name: 'GBB Standard Audit Report',
    description: 'Default internal audit report structure for Galaxy Backbone Limited.',
    isDefault: true,
    sections: [
      { key: 'executive_summary', title: 'Executive Summary', description: 'High-level summary of the audit for senior management', include_findings: false },
      { key: 'background', title: 'Background', description: 'Context and background of the audited entity', include_findings: false },
      { key: 'objectives', title: 'Audit Objectives and Scope', description: 'What the audit set out to achieve and what was covered', include_findings: false },
      { key: 'methodology', title: 'Audit Methodology', description: 'How the audit was conducted', include_findings: false },
      { key: 'findings_summary', title: 'Summary of Findings', description: 'Table of all findings with severity ratings', include_findings: true },
      { key: 'detailed_findings', title: 'Detailed Findings', description: 'Full detail of each finding with recommendations and management responses', include_findings: true },
      { key: 'conclusion', title: 'Conclusion', description: 'Overall audit conclusion and opinion', include_findings: false },
    ],
    availableVariables: [
      { key: '{{engagementTitle}}', description: 'Title of the audit engagement', example: 'Finance Department Financial Audit 2027' },
      { key: '{{engagementReference}}', description: 'Engagement reference number', example: 'AUD-2027-001' },
      { key: '{{auditType}}', description: 'Type of audit', example: 'Financial' },
      { key: '{{auditPeriod}}', description: 'Period covered by the audit', example: 'Q1 2027 (January - March 2027)' },
      { key: '{{universeName}}', description: 'Name of the audited entity', example: 'Finance Department' },
      { key: '{{leadAuditorName}}', description: 'Name of the lead auditor', example: 'Tunde Bakare' },
      { key: '{{auditManagerName}}', description: 'Name of the audit manager', example: 'Adaeze Okonkwo' },
      { key: '{{auditeeName}}', description: 'Name of the auditee', example: 'Chisom Okafor' },
      { key: '{{reportDate}}', description: 'Date the report was issued', example: '30 June 2027' },
      { key: '{{findingCount}}', description: 'Total number of findings', example: '3' },
      { key: '{{criticalCount}}', description: 'Number of critical findings', example: '0' },
      { key: '{{highCount}}', description: 'Number of high findings', example: '1' },
      { key: '{{mediumCount}}', description: 'Number of medium findings', example: '2' },
      { key: '{{lowCount}}', description: 'Number of low findings', example: '0' },
      { key: '{{orgName}}', description: 'Organisation name from system config', example: 'Galaxy Backbone Limited' },
    ],
    headerConfig: {
      orgName: 'Galaxy Backbone Limited',
      address: 'Plot 1510, Cadastral Zone, Abuja',
      reportTitle: 'INTERNAL AUDIT REPORT',
      classification: 'CONFIDENTIAL',
      primaryColor: '003087',
      accentColor: '00A3E0',
    },
    footerConfig: {
      confidentialityNotice: 'This report is confidential and intended solely for the use of Galaxy Backbone Limited Internal Audit Department.',
      includePageNumbers: true,
    },
    signatureConfig: {
      preparedBy: { label: 'Prepared by', showName: true, showTitle: true, showDate: true },
      reviewedBy: { label: 'Reviewed by', showName: true, showTitle: true, showDate: true },
      approvedBy: { label: 'Approved by', showName: true, showTitle: true, showDate: true },
    },
  },
  {
    name: 'GBB Executive Summary Report',
    description: 'Short executive-facing report with emphasis on opinion, high-risk findings, and management action.',
    isDefault: false,
    sections: [
      { key: 'executive_summary', title: 'Executive Summary', description: 'Concise executive summary and overall conclusion', include_findings: false },
      { key: 'findings_summary', title: 'Priority Findings', description: 'Condensed table of findings by severity and status', include_findings: true },
      { key: 'detailed_findings', title: 'Key Details and Management Actions', description: 'Focused details for decision makers', include_findings: true },
      { key: 'conclusion', title: 'Audit Opinion', description: 'Overall audit opinion and next steps', include_findings: false },
    ],
    availableVariables: [
      { key: '{{engagementTitle}}', description: 'Title of the audit engagement', example: 'Network Operations Review' },
      { key: '{{engagementReference}}', description: 'Engagement reference number', example: 'AUD-2027-014' },
      { key: '{{findingCount}}', description: 'Total findings', example: '5' },
      { key: '{{highCount}}', description: 'High findings', example: '2' },
      { key: '{{reportDate}}', description: 'Report date', example: '30 June 2027' },
    ],
    headerConfig: {
      orgName: 'Galaxy Backbone Limited',
      reportTitle: 'EXECUTIVE AUDIT SUMMARY',
      classification: 'CONFIDENTIAL',
      primaryColor: '0F172A',
      accentColor: '00A3E0',
    },
    footerConfig: {
      confidentialityNotice: 'Executive summary prepared for authorised GBB management and oversight stakeholders.',
      includePageNumbers: true,
    },
    signatureConfig: {
      preparedBy: { label: 'Prepared by', showName: true, showTitle: false, showDate: true },
      approvedBy: { label: 'Approved by', showName: true, showTitle: true, showDate: true },
    },
  },
  {
    name: 'IT and Cybersecurity Audit Report',
    description: 'Report structure for IT, cybersecurity, ISO 27001, NIST, COBIT, and PCI DSS audits.',
    isDefault: false,
    sections: [
      { key: 'executive_summary', title: 'Executive Summary', description: 'Security posture and key audit result', include_findings: false },
      { key: 'background', title: 'System and Control Environment', description: 'System context and control environment', include_findings: false },
      { key: 'objectives', title: 'Audit Objectives and Criteria', description: 'IT control objectives and criteria used', include_findings: false },
      { key: 'methodology', title: 'Testing Approach', description: 'Technical testing and evidence approach', include_findings: false },
      { key: 'findings_summary', title: 'Security Findings Summary', description: 'Findings by severity and remediation priority', include_findings: true },
      { key: 'detailed_findings', title: 'Detailed Security Findings', description: 'Detailed IT/cyber findings and management actions', include_findings: true },
      { key: 'conclusion', title: 'Control Effectiveness Opinion', description: 'Overall IT control effectiveness conclusion', include_findings: false },
    ],
    availableVariables: [
      { key: '{{auditType}}', description: 'Audit type', example: 'IT Audit' },
      { key: '{{universeName}}', description: 'System or entity audited', example: 'Active Directory' },
      { key: '{{criticalCount}}', description: 'Critical findings', example: '1' },
      { key: '{{highCount}}', description: 'High findings', example: '3' },
      { key: '{{leadAuditorName}}', description: 'Lead auditor name', example: 'Amina Musa' },
    ],
    headerConfig: {
      orgName: 'Galaxy Backbone Limited',
      reportTitle: 'IT AND CYBERSECURITY AUDIT REPORT',
      classification: 'RESTRICTED',
      primaryColor: '003087',
      accentColor: '16A34A',
    },
    footerConfig: {
      confidentialityNotice: 'This IT audit report may contain sensitive security information and must be handled as restricted.',
      includePageNumbers: true,
    },
    signatureConfig: {
      preparedBy: { label: 'Prepared by', showName: true, showTitle: true, showDate: true },
      reviewedBy: { label: 'Reviewed by', showName: true, showTitle: true, showDate: true },
      approvedBy: { label: 'Approved by', showName: true, showTitle: true, showDate: true },
    },
  },
  {
    name: 'Compliance Audit Report',
    description: 'Report structure for NDPR, ISO, PCI DSS, policy, and regulatory compliance audits.',
    isDefault: false,
    sections: [
      { key: 'executive_summary', title: 'Compliance Summary', description: 'Overall compliance position', include_findings: false },
      { key: 'objectives', title: 'Compliance Criteria and Scope', description: 'Requirements and scope tested', include_findings: false },
      { key: 'methodology', title: 'Assessment Methodology', description: 'Evidence and testing approach', include_findings: false },
      { key: 'findings_summary', title: 'Compliance Exceptions Summary', description: 'Exceptions by severity and status', include_findings: true },
      { key: 'detailed_findings', title: 'Detailed Compliance Exceptions', description: 'Detailed compliance observations and actions', include_findings: true },
      { key: 'conclusion', title: 'Compliance Opinion', description: 'Overall compliance conclusion', include_findings: false },
    ],
    availableVariables: [
      { key: '{{engagementTitle}}', description: 'Engagement title', example: 'NDPR Compliance Review' },
      { key: '{{auditPeriod}}', description: 'Audit period', example: 'Q2 2027' },
      { key: '{{findingCount}}', description: 'Total exceptions', example: '4' },
      { key: '{{auditeeName}}', description: 'Responsible auditee', example: 'Data Protection Officer' },
    ],
    headerConfig: {
      orgName: 'Galaxy Backbone Limited',
      reportTitle: 'COMPLIANCE AUDIT REPORT',
      classification: 'CONFIDENTIAL',
      primaryColor: '003087',
      accentColor: 'CA8A04',
    },
    footerConfig: {
      confidentialityNotice: 'Compliance audit report for authorised GBB use only.',
      includePageNumbers: true,
    },
    signatureConfig: {
      preparedBy: { label: 'Prepared by', showName: true, showTitle: true, showDate: true },
      reviewedBy: { label: 'Reviewed by', showName: true, showTitle: true, showDate: true },
      approvedBy: { label: 'Approved by', showName: true, showTitle: true, showDate: true },
    },
  },
  {
    name: 'Follow-up Audit Report',
    description: 'Report structure for follow-up reviews and remediation validation engagements.',
    isDefault: false,
    sections: [
      { key: 'executive_summary', title: 'Follow-up Summary', description: 'Status of remediation and residual exposure', include_findings: false },
      { key: 'background', title: 'Original Audit Context', description: 'Original report and follow-up basis', include_findings: false },
      { key: 'methodology', title: 'Verification Methodology', description: 'How remediation was verified', include_findings: false },
      { key: 'findings_summary', title: 'Remediation Status Summary', description: 'Status of followed-up findings', include_findings: true },
      { key: 'detailed_findings', title: 'Detailed Verification Results', description: 'Finding-by-finding verification result', include_findings: true },
      { key: 'conclusion', title: 'Residual Risk Conclusion', description: 'Overall residual risk conclusion', include_findings: false },
    ],
    availableVariables: [
      { key: '{{engagementReference}}', description: 'Engagement reference', example: 'AUD-2027-006' },
      { key: '{{findingCount}}', description: 'Findings followed up', example: '7' },
      { key: '{{reportDate}}', description: 'Report date', example: '30 June 2027' },
    ],
    headerConfig: {
      orgName: 'Galaxy Backbone Limited',
      reportTitle: 'FOLLOW-UP AUDIT REPORT',
      classification: 'CONFIDENTIAL',
      primaryColor: '003087',
      accentColor: '7C3AED',
    },
    footerConfig: {
      confidentialityNotice: 'Follow-up audit report for remediation monitoring and audit committee reporting.',
      includePageNumbers: true,
    },
    signatureConfig: {
      preparedBy: { label: 'Verified by', showName: true, showTitle: true, showDate: true },
      reviewedBy: { label: 'Reviewed by', showName: true, showTitle: true, showDate: true },
      approvedBy: { label: 'Approved by', showName: true, showTitle: true, showDate: true },
    },
  },
];

const SYSTEM_CONFIGS: Array<{
  key: string;
  value: string;
  description: string;
  isPublic: boolean;
}> = [
  { key: 'org_name', value: 'Galaxy Backbone Limited', description: 'Full organisation name displayed in reports and public metadata.', isPublic: true },
  { key: 'org_short_name', value: 'GBB', description: 'Short organisation name used in compact UI and references.', isPublic: true },
  { key: 'org_address', value: 'Plot 1510, Cadastral Zone, Abuja, Nigeria', description: 'Organisation address displayed in report headers.', isPublic: true },
  { key: 'org_email', value: 'info@galaxybackbone.com.ng', description: 'Organisation contact email.', isPublic: true },
  { key: 'org_phone', value: '+234 9 291 5555', description: 'Organisation contact phone number.', isPublic: true },
  { key: 'org_website', value: 'https://galaxybackbone.com.ng', description: 'Organisation website URL.', isPublic: true },
  { key: 'audit_dept_name', value: 'Internal Audit Department', description: 'Name of the internal audit department.', isPublic: true },
  { key: 'default_sla_days', value: '30', description: 'Default SLA days for audit engagements.', isPublic: false },
  { key: 'finding_due_days', value: '90', description: 'Default due days assigned to audit findings.', isPublic: false },
  { key: 'report_footer_notice', value: 'This report is confidential and intended solely for the use of Galaxy Backbone Limited Internal Audit Department.', description: 'Default confidentiality notice displayed in audit report footers.', isPublic: false },
  {
    key: 'audit_lifecycle_rules',
    value: JSON.stringify({
      requireAllChecklistsTestedBeforeUnderReview: true,
      requireApprovedWorkingPaperBeforeUnderReview: true,
      requireReportIssuedBeforeReported: true,
      requireClosedFindingsBeforeClose: true,
    }, null, 2),
    description: 'Configurable gates for engagement status transitions.',
    isPublic: false,
  },
  {
    key: 'planning_priority_weights',
    value: JSON.stringify({
      riskScore: 40,
      openFindings: 25,
      overdueForAudit: 20,
      neverAudited: 10,
      timeSinceLastAudit: 5,
    }, null, 2),
    description: 'Relative weights (normalized by their sum) blending the audit-planning priority score: risk score, unresolved findings, audit overdue per frequency, never audited, and time since last audit.',
    isPublic: false,
  },
  {
    key: 'audit_sla_rules',
    value: JSON.stringify({
      defaultEngagementSlaDays: 30,
      defaultFindingDueDays: 90,
      highRiskFindingDueDays: 60,
      criticalFindingDueDays: 30,
    }, null, 2),
    description: 'Default SLA windows used by audit planning, findings, and analytics.',
    isPublic: false,
  },
  {
    key: 'dashboard_kpi_visibility',
    value: JSON.stringify({
      lifecycle: true,
      findings: true,
      riskCoverage: true,
      auditorWorkload: true,
      reporting: true,
      followUp: true,
    }, null, 2),
    description: 'Controls which KPI groups are visible on analytics dashboards.',
    isPublic: false,
  },
  {
    key: 'audit_taxonomy',
    value: JSON.stringify({
      auditTypes: ['it', 'financial', 'compliance', 'systems'],
      priorities: ['critical', 'high', 'medium', 'low'],
      findingSeverities: ['critical', 'high', 'medium', 'low', 'informational'],
      findingCategories: ['it', 'financial', 'compliance', 'systems', 'operational'],
    }, null, 2),
    description: 'Admin-maintained labels used for audit classification and reporting.',
    isPublic: false,
  },
  {
    key: 'approval_matrix',
    value: JSON.stringify({
      auditPlan: ['plan:approve'],
      workingPaper: ['engagement_manager'],
      auditReport: ['engagement_manager', 'report:approve:oversight', 'report:approve:final'],
      findingClosure: ['engagement_manager'],
    }, null, 2),
    description: 'Ordered approver chain the approval engine resolves for plans, working papers, reports, and finding closure. Each level is either "engagement_manager" (the entity\'s assigned manager) or a permission slug resolved to an active holder of that permission. Editable per GBB policy.',
    isPublic: false,
  },
  {
    key: 'checklist_templates',
    value: JSON.stringify({
      it: [
        {
          controlReference: 'ISO27001-A.5.15',
          controlDescription: 'Access control rules are established, documented, and periodically reviewed for all GBB information assets.',
          testProcedure: 'Inspect the access control policy, sample recent user access listings across core systems, and verify evidence of formal management approval and quarterly access reviews.',
        },
        {
          controlReference: 'ISO27001-A.8.13',
          controlDescription: 'System backups of database logs, configurations, and critical data are maintained, secured, and regularly tested.',
          testProcedure: 'Review backup policies and schedules, inspect automated job logs for success rates, and review documentation for recent data restoration exercises.',
        },
        {
          controlReference: 'ISO27001-A.8.16',
          controlDescription: 'Security event logs are collected, analyzed, and monitored to detect anomalous network activities and system events.',
          testProcedure: 'Inspect SIEM dashboards and monitoring configurations, verify log retention periods, and check evidence of timely response to high-priority security alerts.',
        },
        {
          controlReference: 'ISO27001-A.8.20',
          controlDescription: 'Network controls, firewall rules, and remote access systems are managed to secure GBB systems and data.',
          testProcedure: 'Review the firewall rule review schedule, verify segments separating production from testing environments, and inspect VPN multi-factor authorization logs.',
        },
        {
          controlReference: 'ISO27001-A.8.8',
          controlDescription: 'Vulnerabilities in systems, software, and packages are proactively scanned, analyzed, and patched according to risk ratings.',
          testProcedure: 'Inspect recent vulnerability scan reports, review patch management schedules, and trace high-risk vulnerabilities to evidence of mitigation within SLA limits.',
        },
        {
          controlReference: 'ISO27001-A.8.25',
          controlDescription: 'Secure development practices, code quality guidelines, and static code analysis (SAST) are implemented for all internal software.',
          testProcedure: 'Review developers coding guidelines, inspect automated security scans within the CI/CD pipeline, and check code review approval records.',
        },
        {
          controlReference: 'PCIDSS-3.4',
          controlDescription: 'Stored cardholder data is rendered unreadable through strong cryptography, with documented key management procedures.',
          testProcedure: 'Inspect data-at-rest encryption configurations for systems storing cardholder data, review key management and rotation procedures, and sample stored records to confirm the PAN is masked or encrypted.',
        },
        {
          controlReference: 'PCIDSS-8.3',
          controlDescription: 'Access to systems handling cardholder data enforces multi-factor authentication and unique user identification.',
          testProcedure: 'Review authentication configurations for in-scope systems, verify MFA is enforced for all administrative and remote access, and confirm shared or generic accounts are disabled.',
        },
        {
          controlReference: 'PCIDSS-10.2',
          controlDescription: 'Audit trails record all individual access to cardholder data and are protected from alteration.',
          testProcedure: 'Inspect logging configuration on cardholder-data systems, verify log integrity protection and retention periods, and trace a sample of access events to the audit trail.',
        },
        {
          controlReference: 'NIST-CSF-ID.AM',
          controlDescription: 'Physical devices, software platforms, and data flows within GBB are inventoried to support asset management (NIST CSF Identify).',
          testProcedure: 'Review the asset inventory, sample assets against physical and logical records, and verify data-flow documentation is current and approved.',
        },
        {
          controlReference: 'NIST-CSF-PR.AC',
          controlDescription: 'Identities and credentials are issued, managed, and revoked for authorized devices and users (NIST CSF Protect).',
          testProcedure: 'Sample joiner, mover, and leaver records, verify timely provisioning and de-provisioning, and confirm least-privilege access assignment.',
        },
        {
          controlReference: 'NIST-CSF-DE.CM',
          controlDescription: 'Networks and systems are continuously monitored to detect potential cybersecurity events (NIST CSF Detect).',
          testProcedure: 'Inspect monitoring and detection tooling coverage, review alerting thresholds, and verify evidence that detections are investigated within defined timeframes.',
        },
      ],
      financial: [
        {
          controlReference: 'FIN-AP-001',
          controlDescription: 'Financial payment approvals are strictly segregated from payment preparation (maker-checker controls).',
          testProcedure: 'Sample recent payment transactions from the ERP system and verify that the preparing staff and approving manager are distinct individuals.',
        },
        {
          controlReference: 'FIN-REC-001',
          controlDescription: 'Bank and ledger reconciliations are prepared monthly, documented, and independently reviewed by financial managers.',
          testProcedure: 'Inspect a sample of monthly bank reconciliation statements, verify reconciling items have tracking status, and confirm signature evidence of independent review.',
        },
        {
          controlReference: 'FIN-FA-001',
          controlDescription: 'Fixed assets are recorded in the register, physically tagged, and verified through annual physical audits.',
          testProcedure: 'Trace a sample of equipment from the fixed assets register to their physical locations, check asset tag matches, and review the latest physical stocktake report.',
        },
      ],
      compliance: [
        {
          controlReference: 'ISO9001-9.2',
          controlDescription: 'Internal quality audits are planned, scheduled, and conducted independently to evaluate Quality Management System compliance.',
          testProcedure: 'Inspect the QMS annual audit plan, review audit reports, check auditor independence, and verify that findings were presented to the quality committee.',
        },
        {
          controlReference: 'ISO9001-10.2',
          controlDescription: 'Nonconformities and customer complaints are logged, analyzed for root cause, and resolved with documented corrective actions.',
          testProcedure: 'Review the complaints registry, sample nonconformities, inspect root cause analyses, and check evidence of follow-up validation audits.',
        },
        {
          controlReference: 'ISO9001-7.2',
          controlDescription: 'Personnel competencies, certifications, and required training programs are planned, tracked, and documented.',
          testProcedure: 'Inspect training plans, review job descriptions against staff qualification certificates, and sample training completion logs.',
        },
        {
          controlReference: 'ISO22301-8.2',
          controlDescription: 'Business Impact Analysis (BIA) and risk assessments are periodically updated to define recovery priorities (RTO & RPO).',
          testProcedure: 'Review the latest BIA document, check alignment of recovery priorities with GBB business goals, and confirm executive approval of operational thresholds.',
        },
        {
          controlReference: 'ISO22301-8.4',
          controlDescription: 'Business Continuity Plans (BCP) and incident response procedures are established, documented, and made accessible.',
          testProcedure: 'Inspect the BCP document, verify contacts listing of the crisis management team, and check availability of plans to key staff.',
        },
        {
          controlReference: 'ISO22301-8.5',
          controlDescription: 'Business continuity plans and disaster recovery procedures are tested annually through simulated exercises.',
          testProcedure: 'Inspect the business continuity exercise schedule, review the latest post-exercise test report, and check evidence of remediation for failures.',
        },
        {
          controlReference: 'NDPR-PRIV-001',
          controlDescription: 'Personal data processing activities have a documented lawful basis, privacy notices, and consent registries under NDPR.',
          testProcedure: 'Inspect GBB privacy notices on public portals, review internal data inventories, check data processing consent logs, and verify DPO audit filing records.',
        },
        {
          controlReference: 'NDPR-PRIV-002',
          controlDescription: 'Data subject rights — access, rectification, erasure, and objection — are supported through documented, time-bound request handling procedures.',
          testProcedure: 'Inspect the data subject request procedure, sample fulfilled requests, and verify responses were provided within statutory timelines with evidence retained.',
        },
        {
          controlReference: 'NDPR-NITDA-001',
          controlDescription: 'GBB meets its NITDA obligations under the NDPR, including the annual data protection audit filing and engagement of a licensed Data Protection Compliance Organisation (DPCO).',
          testProcedure: 'Verify the most recent NITDA data protection audit was filed within the deadline, confirm DPCO engagement records, and review evidence of remediation of prior filing observations.',
        },
        {
          controlReference: 'ISO31000-6.4',
          controlDescription: 'Risks are systematically identified, analyzed, and evaluated against defined criteria within the enterprise risk management process (ISO 31000 Risk Assessment).',
          testProcedure: 'Review the risk management framework and risk register, verify risks are scored against documented criteria, and confirm evaluation outcomes drive treatment decisions.',
        },
        {
          controlReference: 'ISO31000-6.5',
          controlDescription: 'Risk treatment plans are selected, implemented, and tracked to reduce risks to acceptable levels (ISO 31000 Risk Treatment).',
          testProcedure: 'Sample risks with treatment plans, verify owners and target dates, and confirm evidence that residual risk is monitored against the defined risk appetite.',
        },
        {
          controlReference: 'ISO31000-6.6',
          controlDescription: 'Risk management performance is monitored, reviewed, and reported to governance bodies at defined intervals (ISO 31000 Monitoring & Review).',
          testProcedure: 'Inspect risk reporting to management and the board, verify review frequency against policy, and confirm actions arising are tracked to closure.',
        },
      ],
      systems: [
        {
          controlReference: 'SYS-INF-001',
          controlDescription: 'Baseline configurations for infrastructure, databases, and network devices are defined, approved, and monitored for drift.',
          testProcedure: 'Inspect documented server baseline guidelines, compare a sample of production configurations against baselines, and review unauthorized change alerts.',
        },
        {
          controlReference: 'SYS-CHG-001',
          controlDescription: 'Changes to production systems require formal Change Advisory Board (CAB) review, test reports, and rollback plans.',
          testProcedure: 'Sample change tickets, verify CAB approval signatures, check test environment logs, and confirm a documented and tested rollback procedure was attached.',
        },
        {
          controlReference: 'SYS-DR-001',
          controlDescription: 'Disaster recovery environments match production setups and support live database replication with minimal lag.',
          testProcedure: 'Inspect database replication dashboards, check replication lag metrics, and review the latest live DR switchover/failover test report.',
        },
        {
          controlReference: 'SYS-CAP-001',
          controlDescription: 'System utilization, bandwidth, CPU, and storage performance are monitored to forecast capacity requirements.',
          testProcedure: 'Review recent capacity monitoring reports, check automated threshold warnings, and inspect documented scaling and upgrades plans.',
        },
        {
          controlReference: 'ISO20000-8.6.1',
          controlDescription: 'Incident and service request management procedures ensure timely recording, prioritization, and resolution against agreed SLAs (ISO 20000 Service Management).',
          testProcedure: 'Sample incident and service-request tickets from the ITSM system, verify SLA timers and prioritization, and confirm resolution and closure evidence.',
        },
        {
          controlReference: 'ISO20000-8.7.1',
          controlDescription: 'Service level agreements are defined, documented, and reviewed against actual service performance (ISO 20000 Service Level Management).',
          testProcedure: 'Inspect the SLA catalogue, review the latest service performance reports against SLA targets, and confirm evidence of management review of breaches.',
        },
        {
          controlReference: 'COBIT-APO13',
          controlDescription: 'A security management system is established and maintained to govern information security in line with enterprise objectives (COBIT Managed Security).',
          testProcedure: 'Review the ISMS governance documentation, verify alignment of security objectives to enterprise goals, and inspect management review minutes.',
        },
        {
          controlReference: 'COBIT-BAI06',
          controlDescription: 'IT changes are managed through a controlled process covering assessment, authorization, and tracking (COBIT Managed IT Changes).',
          testProcedure: 'Sample change records, verify impact assessment and authorization, and confirm emergency changes followed the defined exception process.',
        },
      ],
    }, null, 2),
    description: 'Control procedures used when an engagement starts and checklists are populated.',
    isPublic: false,
  },
  {
    key: 'version_retention',
    value: JSON.stringify({ enabled: false, keepLastVersions: 10 }),
    description: 'Opt-in document version retention policy. OFF by default to preserve full audit traceability and immutability. When enabled, the weekly prune job keeps only the N most recent document_versions per document and deletes older storage files.',
    isPublic: false,
  },
  {
    key: 'escalation_matrix',
    value: JSON.stringify({
      auditEngagement: { level3: ['director'], beyond: ['cae'] },
      workflowApproval: { level3: ['director'], level4: ['cae'], otherwise: ['audit_manager'] },
    }, null, 2),
    description: 'Escalation notification targets per tier. Maps escalation levels beyond the entity\'s own assignees (lead auditor / manager / current approver) to the role names whose holders are notified. Edit when GBB renames or restructures oversight roles.',
    isPublic: false,
  },
  {
    key: 'data_retention',
    value: JSON.stringify({
      auditLogDays: 2555,
      notificationDays: 365,
      emailLogDays: 365,
      authTokenDays: 90,
    }, null, 2),
    description: 'NDPR data-retention periods in days, enforced by the weekly retention purge job (BG:RETENTION:PURGE:WEEKLY). auditLogDays: compliance audit trail (default ~7 years); notificationDays: in-app notifications; emailLogDays: email delivery logs; authTokenDays: consumed/expired password-reset tokens and email OTPs (both hold IP addresses). Set a value to 0 to disable purging for that category. See docs/NDPR_RETENTION_SCHEDULE.md.',
    isPublic: false,
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
    email: 'superadmin@gbb.gov.ng',
    legacyEmail: 'admin@example.com',
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
  // In production only the super admin is seeded; the other accounts are dev/test fixtures.
  const usersToSeed =
    process.env.NODE_ENV === 'production'
      ? SEEDED_USERS.filter((u) => u.roles.includes('super_admin'))
      : SEEDED_USERS;
  let adminUserId = '';
  for (const seedUser of usersToSeed) {
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

    // Templates below need a creator: admin@example.com in dev, but that user
    // isn't seeded in production — fall back to the first (super admin) user.
    if (seedUser.email === 'admin@example.com' || !adminUserId) {
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

  // 6. Upsert default working paper templates.
  for (const tpl of WORKING_PAPER_TEMPLATES) {
    if (tpl.isDefault) {
      await prisma.working_Paper_Template.updateMany({
        where: {
          audit_type: tpl.auditType,
          name: { not: tpl.name },
        },
        data: { is_default: false },
      });
    }

    await prisma.working_Paper_Template.upsert({
      where: { name: tpl.name },
      create: {
        name: tpl.name,
        description: tpl.description,
        audit_type: tpl.auditType,
        sections: JSON.stringify(tpl.sections),
        is_active: true,
        is_default: tpl.isDefault,
        created_by_id: adminUserId || null,
      },
      update: {
        description: tpl.description,
        audit_type: tpl.auditType,
        sections: JSON.stringify(tpl.sections),
        is_active: true,
        is_default: tpl.isDefault,
        deleted_at: null,
        updated_by_id: adminUserId || null,
      },
    });
  }
  logger.info('Working paper templates seeded', { count: WORKING_PAPER_TEMPLATES.length });

  // 7. Upsert default report templates.
  for (const tpl of REPORT_TEMPLATES) {
    if (tpl.isDefault) {
      await prisma.report_Template.updateMany({
        where: { name: { not: tpl.name } },
        data: { is_default: false },
      });
    }

    await prisma.report_Template.upsert({
      where: { name: tpl.name },
      create: {
        name: tpl.name,
        description: tpl.description,
        sections: JSON.stringify(tpl.sections),
        header_config: JSON.stringify(tpl.headerConfig),
        footer_config: JSON.stringify(tpl.footerConfig),
        signature_config: JSON.stringify(tpl.signatureConfig),
        available_variables: JSON.stringify(tpl.availableVariables),
        is_active: true,
        is_default: tpl.isDefault,
        created_by_id: adminUserId || null,
      },
      update: {
        description: tpl.description,
        sections: JSON.stringify(tpl.sections),
        header_config: JSON.stringify(tpl.headerConfig),
        footer_config: JSON.stringify(tpl.footerConfig),
        signature_config: JSON.stringify(tpl.signatureConfig),
        available_variables: JSON.stringify(tpl.availableVariables),
        is_active: true,
        is_default: tpl.isDefault,
        deleted_at: null,
        updated_by_id: adminUserId || null,
      },
    });
  }
  logger.info('Report templates seeded', { count: REPORT_TEMPLATES.length });

  // 8. Upsert system configuration keys.
  for (const cfg of SYSTEM_CONFIGS) {
    await prisma.system_Config.upsert({
      where: { key: cfg.key },
      create: {
        key: cfg.key,
        value: cfg.value,
        description: cfg.description,
        is_public: cfg.isPublic,
        updated_by_id: adminUserId || null,
      },
      // Never touch `value` on re-seed: existing rows may hold admin-edited
      // config (approval matrix, priority weights, retention periods) that a
      // re-run must not silently reset to defaults.
      update: {
        description: cfg.description,
        is_public: cfg.isPublic,
      },
    });
  }
  logger.info('System configuration seeded', { count: SYSTEM_CONFIGS.length });

  logger.info('Seed complete');
}

// Only run the full seed when executed directly (`ts-node prisma/seed.ts`).
// Importing this file (e.g. scripts/seed-role-permissions.ts) must NOT re-seed.
if (require.main === module) {
  main()
    .catch((err: unknown) => {
      logger.error('Seed failed', { err });
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
