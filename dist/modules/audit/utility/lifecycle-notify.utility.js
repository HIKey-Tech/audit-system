"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyEngagementLifecycleChange = exports.syncLifecycleNotificationPermission = exports.LIFECYCLE_NOTIFY_PERMISSION = void 0;
const prisma_client_1 = require("../../../shared/prisma/prisma.client");
const app_config_1 = require("../../../shared/config/app.config");
const logger_util_1 = require("../../../shared/utils/logger.util");
const notification_queue_service_1 = require("../../messaging/service/implementation/notification-queue.service");
exports.LIFECYCLE_NOTIFY_PERMISSION = 'engagement:notify_lifecycle';
const STAGE_LABELS = {
    planned: 'Planned',
    in_progress: 'In Progress (Fieldwork Started)',
    under_review: 'Under Review (Quality Assurance)',
    reported: 'Reported (Audit Report Issued)',
    closed: 'Closed (Completed)',
};
const formatStage = (status) => {
    if (!status)
        return 'Created';
    return STAGE_LABELS[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};
const formatDate = (date) => {
    if (!date)
        return '—';
    return date.toISOString().slice(0, 10);
};
const displayNameOf = (u) => {
    if (!u)
        return '—';
    return u.display_name?.trim() || `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email || '—';
};
/**
 * Ensures the `engagement:notify_lifecycle` permission, report sign-off permissions,
 * and audit taxonomy are synchronized in the database using permission-based rules
 * rather than hardcoded role names.
 */
const syncLifecycleNotificationPermission = async () => {
    try {
        const perm = await prisma_client_1.prisma.permission.upsert({
            where: { slug: exports.LIFECYCLE_NOTIFY_PERMISSION },
            update: {
                name: 'Receive Engagement Lifecycle Notifications',
                description: 'Receive email and in-app notifications whenever any audit engagement starts, changes stage, or closes',
            },
            create: {
                name: 'Receive Engagement Lifecycle Notifications',
                slug: exports.LIFECYCLE_NOTIFY_PERMISSION,
                module: 'audit',
                action: 'notify_lifecycle',
                description: 'Receive email and in-app notifications whenever any audit engagement starts, changes stage, or closes',
            },
        });
        // Grant engagement:notify_lifecycle to any role that holds engagement:read_all or wildcard '*'
        const oversightRoles = await prisma_client_1.prisma.role.findMany({
            where: {
                role_permissions: {
                    some: {
                        permission: {
                            slug: { in: ['engagement:read_all', '*'] },
                        },
                    },
                },
            },
            select: { id: true },
        });
        for (const role of oversightRoles) {
            await prisma_client_1.prisma.role_Permission.upsert({
                where: {
                    role_id_permission_id: {
                        role_id: role.id,
                        permission_id: perm.id,
                    },
                },
                update: {},
                create: {
                    role_id: role.id,
                    permission_id: perm.id,
                },
            });
        }
        // Ensure Head of Internal Audit roles (those holding report:issue) hold report:approve:oversight
        // (Level 2 sign-off) while executive oversight roles hold report:approve:final (Level 3 sign-off).
        const [oversightPerm, finalPerm, issuePerm] = await Promise.all([
            prisma_client_1.prisma.permission.findUnique({ where: { slug: 'report:approve:oversight' }, select: { id: true } }),
            prisma_client_1.prisma.permission.findUnique({ where: { slug: 'report:approve:final' }, select: { id: true } }),
            prisma_client_1.prisma.permission.findUnique({ where: { slug: 'report:issue' }, select: { id: true } }),
        ]);
        if (oversightPerm && finalPerm && issuePerm) {
            // Roles that hold report:issue (Head of IA) should hold report:approve:oversight
            const issueRoles = await prisma_client_1.prisma.role.findMany({
                where: {
                    role_permissions: { some: { permission_id: issuePerm.id } },
                },
                select: { id: true },
            });
            for (const r of issueRoles) {
                await prisma_client_1.prisma.role_Permission.upsert({
                    where: { role_id_permission_id: { role_id: r.id, permission_id: oversightPerm.id } },
                    update: {},
                    create: { role_id: r.id, permission_id: oversightPerm.id },
                });
                await prisma_client_1.prisma.role_Permission.deleteMany({
                    where: { role_id: r.id, permission_id: finalPerm.id },
                });
            }
            // Roles that previously held report:approve:oversight without report:issue or report:create
            // (Executive / Director General tier) should hold report:approve:final
            const execRoles = await prisma_client_1.prisma.role.findMany({
                where: {
                    role_permissions: {
                        some: { permission_id: oversightPerm.id },
                        none: { permission: { slug: { in: ['report:issue', 'report:create', '*'] } } },
                    },
                },
                select: { id: true },
            });
            for (const r of execRoles) {
                await prisma_client_1.prisma.role_Permission.upsert({
                    where: { role_id_permission_id: { role_id: r.id, permission_id: finalPerm.id } },
                    update: {},
                    create: { role_id: r.id, permission_id: finalPerm.id },
                });
                await prisma_client_1.prisma.role_Permission.deleteMany({
                    where: { role_id: r.id, permission_id: oversightPerm.id },
                });
            }
        }
        // Ensure audit_taxonomy includes all 10 audit types and finding categories
        const allTypes = [
            'it',
            'systems',
            'financial',
            'compliance',
            'operational',
            'pension',
            'procurement',
            'hr_payroll',
            'project',
            'special',
        ];
        await prisma_client_1.prisma.system_Config.upsert({
            where: { key: 'audit_taxonomy' },
            update: {
                value: JSON.stringify({
                    auditTypes: allTypes,
                    priorities: ['critical', 'high', 'medium', 'low'],
                    findingSeverities: ['critical', 'high', 'medium', 'low', 'informational'],
                    findingCategories: allTypes,
                }, null, 2),
            },
            create: {
                key: 'audit_taxonomy',
                value: JSON.stringify({
                    auditTypes: allTypes,
                    priorities: ['critical', 'high', 'medium', 'low'],
                    findingSeverities: ['critical', 'high', 'medium', 'low', 'informational'],
                    findingCategories: allTypes,
                }, null, 2),
                description: 'Admin-maintained labels used for audit classification and reporting.',
                is_public: false,
            },
        });
        // Ensure default Working Paper Templates exist for all specialized audit types
        const domainWpTemplates = [
            {
                name: 'Standard Systems Audit Working Paper',
                description: 'Default working paper structure for system baseline, configuration, change, and continuity procedures.',
                auditType: 'systems',
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
                name: 'Standard Operational Audit Working Paper',
                description: 'Default working paper structure for operational efficiency, SOP, and OLA/KPI audit procedures.',
                auditType: 'operational',
                sections: [
                    { title: 'Process & SOP Objective', description: 'State the operational process and SOP under review', placeholder: 'Identify the operational unit, SOP reference, and target OLA/KPI...', required: true },
                    { title: 'Control & Process Design', description: 'Describe how the operational process is designed to run', placeholder: 'Summarize the workflow, handoffs, and supervisory checkpoints...', required: true },
                    { title: 'Test Procedure', description: 'Describe the walkthrough and sample testing performed', placeholder: 'Document sample selection, turnaround time analysis, and inspection steps...', required: true },
                    { title: 'Evidence Reviewed', description: 'List operational logs, SOPs, and performance reports reviewed', placeholder: 'Reference operational registers, SLA/OLA reports, and sign-off sheets...', required: true },
                    { title: 'Exceptions & Bottlenecks', description: 'Document any process delays, OLA breaches, or control gaps', placeholder: 'Detail any exceptions, root causes, and operational impact...', required: false },
                    { title: 'Conclusion', description: 'State the conclusion on operational effectiveness', placeholder: 'Conclude whether the process operates efficiently and in line with SOPs...', required: true },
                ],
            },
            {
                name: 'Standard Pension Audit Working Paper',
                description: 'Default working paper structure for PENCOM / PRA 2014 pension remittance, PFA reconciliation, and retirement benefit audits.',
                auditType: 'pension',
                sections: [
                    { title: 'Statutory Requirement (PRA 2014 / PENCOM)', description: 'Cite the applicable Pension Reform Act 2014 or PENCOM guideline requirement', placeholder: 'e.g. PRA 2014 Section 11(3)(b) — remittance within 7 working days of salary payment...', required: true },
                    { title: 'Population & Payroll Period', description: 'Define the payroll and PFA remittance schedules tested', placeholder: 'Specify the months covered, active headcount, and total employer/employee contribution value...', required: true },
                    { title: 'Test Procedure', description: 'Document recalculation and remittance tracing steps', placeholder: 'Recalculate 10% employer / 8% employee rates, trace PFA schedules to PFC receipts, verify RSA PINs...', required: true },
                    { title: 'Evidence Reviewed', description: 'List payroll registers, PFA schedules, and PFC payment receipts', placeholder: 'Reference payroll summaries, PFC acknowledgement receipts, Group Life policy certificate...', required: true },
                    { title: 'Exceptions & Uncredited Remittances', description: 'Record late remittances, rate variances, or uncredited RSA accounts', placeholder: 'Detail any delayed remittances beyond 7 working days, missing RSA PINs, or unremitted deductions...', required: false },
                    { title: 'Conclusion', description: 'Conclude on statutory pension compliance', placeholder: 'State whether pension deductions, remittances, and reconciliations comply with PRA 2014...', required: true },
                ],
            },
            {
                name: 'Standard Procurement Audit Working Paper',
                description: 'Default working paper structure for Public Procurement Act (PPA 2007), BPP threshold, bidding, and contract award audits.',
                auditType: 'procurement',
                sections: [
                    { title: 'Procurement & Statutory Criteria (PPA 2007)', description: 'State the procurement method, threshold, and regulatory criteria tested', placeholder: 'Cite applicable PPA 2007 / BPP threshold, solicitation method, and approval authority...', required: true },
                    { title: 'Contracts & POs Sampled', description: 'Identify the procurement files, tenders, or purchase orders tested', placeholder: 'List contract references, vendor names, award values, and procurement dates...', required: true },
                    { title: 'Test Procedure', description: 'Describe vendor due diligence, bid evaluation, and 3-way match testing', placeholder: 'Verify CAC/TCC/PENCOM/ITF/NSITF certificates, bid evaluation reports, Tenders Board minutes, and PO/GRN/Invoice matching...', required: true },
                    { title: 'Evidence Reviewed', description: 'List tender files, evaluation sheets, and payment vouchers inspected', placeholder: 'Reference bid opening registers, evaluation score sheets, signed contracts, and JCC/GRNs...', required: true },
                    { title: 'Procurement Exceptions', description: 'Document any threshold breaches, contract splitting, or documentation gaps', placeholder: 'Detail any non-competitive awards, expired compliance certificates, or pricing variances...', required: false },
                    { title: 'Conclusion', description: 'Conclude on procurement compliance and value for money', placeholder: 'State whether procurement activities complied with PPA 2007 and institutional policy...', required: true },
                ],
            },
            {
                name: 'Standard HR & Payroll Audit Working Paper',
                description: 'Default working paper structure for nominal roll reconciliation, joiners/movers/leavers, and statutory payroll deduction audits.',
                auditType: 'hr_payroll',
                sections: [
                    { title: 'HR / Payroll Control Objective', description: 'State the HR or payroll control objective being tested', placeholder: 'e.g. Nominal roll to payroll reconciliation, JML authorization, or PAYE/NHF/NSITF remittance...', required: true },
                    { title: 'Population & Pay Cycles Covered', description: 'Specify the HR master file and monthly payroll registers in scope', placeholder: 'State the pay periods, staff headcount, and gross/net payroll totals...', required: true },
                    { title: 'Test Procedure', description: 'Describe headcount tie-out, BVN/account duplicate checks, and recalculations', placeholder: 'Compare HR nominal roll to bank payment file, test joiner/leaver cut-off, recalculate statutory deductions...', required: true },
                    { title: 'Evidence Reviewed', description: 'List HR files, payroll summaries, and tax remittance receipts', placeholder: 'Reference appointment/exit letters, variance approvals, bank upload schedules, and tax receipts...', required: true },
                    { title: 'Exceptions Noted', description: 'Document any unauthorized additions, post-exit payments, or deduction errors', placeholder: 'Detail any discrepancies between nominal roll and payroll or late statutory remittances...', required: false },
                    { title: 'Conclusion', description: 'Conclude on HR and payroll control effectiveness', placeholder: 'State whether payroll disbursements and HR records are accurate and properly authorized...', required: true },
                ],
            },
            {
                name: 'Standard Project / Capital Audit Working Paper',
                description: 'Default working paper structure for capital project governance, milestone verification, variation orders, and budget tracking.',
                auditType: 'project',
                sections: [
                    { title: 'Project Scope & Governance Objective', description: 'Identify the project, charter, budget, and governance criteria under review', placeholder: 'State project name, contract sum, timeline, project sponsor, and deliverable scope...', required: true },
                    { title: 'Deliverables & Milestones Sampled', description: 'List project milestones, variation orders, and payment certificates tested', placeholder: 'Detail milestone numbers, completion dates, variation requests, and certified amounts...', required: true },
                    { title: 'Test Procedure', description: 'Describe physical/technical verification and financial tie-out steps', placeholder: 'Inspect JCCs/UAT sign-offs, verify Steering Committee approval for variations, compare spend to budget...', required: true },
                    { title: 'Evidence Reviewed', description: 'List project charters, milestone certificates, and payment vouchers', placeholder: 'Reference business case, BoQ/deliverables schedule, inspection reports, and retention records...', required: true },
                    { title: 'Project Exceptions & Cost/Schedule Variances', description: 'Record unapproved variations, delayed milestones, or budget overruns', placeholder: 'Detail any payments released without sign-off, scope creep, or deliverable defects...', required: false },
                    { title: 'Conclusion', description: 'Conclude on project governance and delivery assurance', placeholder: 'State whether project execution, spend, and deliverables align with approved charter and contract terms...', required: true },
                ],
            },
            {
                name: 'Standard Special Investigation Working Paper',
                description: 'Default working paper structure for forensic reviews, ad-hoc investigations, evidence chain-of-custody, and loss quantification.',
                auditType: 'special',
                sections: [
                    { title: 'Terms of Reference & Mandate', description: 'State the investigation mandate, allegation, or issue under review', placeholder: 'Reference the approved ToR, period covered, and specific allegations or anomalies...', required: true },
                    { title: 'Chain of Custody & Sources', description: 'Document all digital, physical, and documentary evidence collected', placeholder: 'List source systems, transaction logs, interview records, and custody preservation details...', required: true },
                    { title: 'Investigative Procedures Performed', description: 'Detail forensic analysis, transaction reconstruction, and interviews conducted', placeholder: 'Describe timeline reconstruction, data analytics, corroborative inquiries, and document examination...', required: true },
                    { title: 'Factual Findings & Corroboration', description: 'Present the established facts and supporting evidence', placeholder: 'Document verified facts, control breakdowns, and quantified financial/operational exposure...', required: true },
                    { title: 'Root Cause & Accountability', description: 'Identify how the breakdown occurred and responsible parties/controls', placeholder: 'Detail the control override or gap, systemic weaknesses, and remediation/recovery actions...', required: false },
                    { title: 'Conclusion & Recommendations', description: 'State the investigation conclusion and recommended actions', placeholder: 'Conclude on the allegation/mandate and state corrective, recovery, or governance recommendations...', required: true },
                ],
            },
        ];
        for (const tpl of domainWpTemplates) {
            await prisma_client_1.prisma.working_Paper_Template.upsert({
                where: { name: tpl.name },
                update: {
                    audit_type: tpl.auditType,
                    is_default: true,
                    is_active: true,
                    sections: JSON.stringify(tpl.sections),
                },
                create: {
                    name: tpl.name,
                    description: tpl.description,
                    audit_type: tpl.auditType,
                    is_default: true,
                    is_active: true,
                    sections: JSON.stringify(tpl.sections),
                },
            });
        }
    }
    catch (err) {
        logger_util_1.logger.warn('Failed to sync engagement:notify_lifecycle permission on startup', { err });
    }
};
exports.syncLifecycleNotificationPermission = syncLifecycleNotificationPermission;
/**
 * Notifies holders of `engagement:notify_lifecycle` (Head of Internal Audit / oversight),
 * the engagement audit team, and (on start/close) the auditee whenever an engagement
 * starts, moves from one stage to another, or closes.
 */
const notifyEngagementLifecycleChange = async (engagementId, previousStatus, newStatus, actorId) => {
    try {
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: engagementId, deleted_at: null },
            include: {
                universe: { select: { name: true } },
                workflow_assignments: {
                    include: {
                        user: {
                            select: { id: true, email: true, display_name: true, first_name: true, last_name: true, is_active: true, deleted_at: true },
                        },
                    },
                },
            },
        });
        if (!engagement)
            return;
        const coreUserIds = Array.from(new Set([engagement.lead_auditor_id, engagement.audit_manager_id, engagement.auditee_id, actorId].filter((x) => Boolean(x))));
        const [coreUsers, oversightHolders] = await Promise.all([
            prisma_client_1.prisma.user.findMany({
                where: { id: { in: coreUserIds }, deleted_at: null },
                select: { id: true, email: true, display_name: true, first_name: true, last_name: true, is_active: true },
            }),
            prisma_client_1.prisma.user.findMany({
                where: {
                    deleted_at: null,
                    is_active: true,
                    user_roles: {
                        some: {
                            role: {
                                role_permissions: {
                                    some: {
                                        permission: {
                                            slug: { in: [exports.LIFECYCLE_NOTIFY_PERMISSION, '*'] },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                select: { id: true, email: true, display_name: true, first_name: true, last_name: true, is_active: true },
            }),
        ]);
        const userById = new Map(coreUsers.map((u) => [u.id, u]));
        const leadUser = userById.get(engagement.lead_auditor_id);
        const managerUser = userById.get(engagement.audit_manager_id);
        const auditeeUser = userById.get(engagement.auditee_id);
        const actorUser = actorId ? userById.get(actorId) : undefined;
        const supportingTeamNames = engagement.workflow_assignments
            .map((a) => displayNameOf(a.user))
            .filter((n) => n !== '—');
        const teamSummary = supportingTeamNames.length > 0 ? supportingTeamNames.join(', ') : 'None assigned';
        const eventKey = newStatus === 'in_progress'
            ? 'audit.engagement.started'
            : newStatus === 'closed'
                ? 'audit.engagement.closed'
                : 'audit.engagement.stage_changed';
        const previousStageLabel = formatStage(previousStatus);
        const newStageLabel = formatStage(newStatus);
        const entityName = engagement.universe?.name ?? engagement.title;
        const auditTypeLabel = engagement.audit_type.replace(/_/g, ' ').toUpperCase();
        const plannedSchedule = `${formatDate(engagement.planned_start_date)} to ${formatDate(engagement.planned_end_date)}`;
        const olaDeadline = formatDate(engagement.sla_deadline);
        const closedDate = formatDate(engagement.actual_end_date ?? new Date());
        const actionUrl = `${app_config_1.config.app.frontendUrl.replace(/\/$/, '')}/audit/engagements/${engagement.id}`;
        // Collect recipients: oversight holders + lead + manager + supporting team + (auditee on start/close)
        const recipientsMap = new Map();
        for (const u of oversightHolders) {
            if (u.is_active) {
                recipientsMap.set(u.id, { id: u.id, email: u.email, name: displayNameOf(u) });
            }
        }
        if (leadUser?.is_active) {
            recipientsMap.set(leadUser.id, { id: leadUser.id, email: leadUser.email, name: displayNameOf(leadUser) });
        }
        if (managerUser?.is_active) {
            recipientsMap.set(managerUser.id, { id: managerUser.id, email: managerUser.email, name: displayNameOf(managerUser) });
        }
        for (const a of engagement.workflow_assignments) {
            if (a.user && a.user.is_active && a.user.deleted_at === null) {
                recipientsMap.set(a.user.id, { id: a.user.id, email: a.user.email, name: displayNameOf(a.user) });
            }
        }
        if ((newStatus === 'in_progress' || newStatus === 'closed' || newStatus === 'reported') && auditeeUser?.is_active) {
            recipientsMap.set(auditeeUser.id, { id: auditeeUser.id, email: auditeeUser.email, name: displayNameOf(auditeeUser) });
        }
        const baseVariables = {
            engagementTitle: engagement.title,
            engagementReference: engagement.reference_number,
            entityName,
            auditType: auditTypeLabel,
            previousStage: previousStageLabel,
            newStage: newStageLabel,
            leadAuditorName: displayNameOf(leadUser),
            managerName: displayNameOf(managerUser),
            auditeeName: displayNameOf(auditeeUser),
            supportingTeam: teamSummary,
            plannedSchedule,
            olaDeadline,
            closedDate,
            actorName: displayNameOf(actorUser),
            actionUrl,
        };
        const title = newStatus === 'in_progress'
            ? `Audit Engagement Started: ${engagement.reference_number}`
            : newStatus === 'closed'
                ? `Audit Engagement Closed: ${engagement.reference_number}`
                : `Engagement Stage Updated (${newStageLabel}): ${engagement.reference_number}`;
        const body = newStatus === 'in_progress'
            ? `Engagement "${engagement.title}" (${engagement.reference_number}) on ${entityName} has started fieldwork. Lead: ${baseVariables.leadAuditorName}, Auditee: ${baseVariables.auditeeName}.`
            : newStatus === 'closed'
                ? `Engagement "${engagement.title}" (${engagement.reference_number}) on ${entityName} has been closed on ${closedDate}.`
                : `Engagement "${engagement.title}" (${engagement.reference_number}) moved from ${previousStageLabel} to ${newStageLabel}.`;
        for (const recipient of recipientsMap.values()) {
            const variables = {
                ...baseVariables,
                recipientName: recipient.name,
            };
            await notification_queue_service_1.notificationQueueService.enqueueSafe('in_app', {
                userId: recipient.id,
                title,
                body,
                type: newStatus === 'closed' ? 'success' : 'info',
                referenceType: 'audit_engagement',
                referenceId: engagement.id,
                eventKey,
                variables,
            });
            if (recipient.email) {
                await notification_queue_service_1.notificationQueueService.enqueueSafe('email', {
                    to: recipient.email,
                    subject: `${title} — ${engagement.title}`,
                    text: [
                        `Dear ${recipient.name},`,
                        '',
                        body,
                        '',
                        `Engagement: ${engagement.title}`,
                        `Reference: ${engagement.reference_number}`,
                        `Auditable Entity: ${entityName}`,
                        `Audit Type: ${auditTypeLabel}`,
                        `Stage Transition: ${previousStageLabel} → ${newStageLabel}`,
                        `Lead Auditor: ${baseVariables.leadAuditorName}`,
                        `Audit Manager: ${baseVariables.managerName}`,
                        `Supporting Team: ${teamSummary}`,
                        `Auditee: ${baseVariables.auditeeName}`,
                        `Schedule: ${plannedSchedule}`,
                        `OLA Deadline: ${olaDeadline}`,
                        ...(newStatus === 'closed' ? [`Closed Date: ${closedDate}`] : []),
                        '',
                        'Please log in to IAMS for full engagement details.',
                        '',
                        'Regards,',
                        'IAMS — Internal Audit System',
                    ].join('\n'),
                    eventKey,
                    variables,
                });
            }
        }
    }
    catch (err) {
        logger_util_1.logger.warn('Failed to send engagement lifecycle notifications', { engagementId, newStatus, err });
    }
};
exports.notifyEngagementLifecycleChange = notifyEngagementLifecycleChange;
//# sourceMappingURL=lifecycle-notify.utility.js.map