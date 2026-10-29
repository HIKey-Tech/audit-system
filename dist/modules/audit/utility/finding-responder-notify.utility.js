"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyFindingResponders = void 0;
const prisma_client_1 = require("../../../shared/prisma/prisma.client");
const logger_util_1 = require("../../../shared/utils/logger.util");
const notification_queue_service_1 = require("../../messaging/service/implementation/notification-queue.service");
/**
 * Tell every responder (primary auditee + co-responders) about the findings assigned to them on
 * an engagement, one notification per person.
 *
 * - `draft`: fieldwork is complete (Quality Assurance). Findings are visible and the management
 *   response is requested *before* the report is issued, so it can go into the report.
 * - `issued`: the report has been issued.
 *
 * Best-effort: never throws into the caller.
 */
const notifyFindingResponders = async (engagementId, engagementReference, stage) => {
    try {
        const userSelect = { id: true, email: true };
        const findings = await prisma_client_1.prisma.audit_Finding.findMany({
            where: { engagement_id: engagementId, deleted_at: null },
            select: {
                id: true,
                title: true,
                due_date: true,
                auditee: { select: userSelect },
                responders: { select: { user: { select: userSelect } } },
            },
        });
        const byUser = new Map();
        for (const finding of findings) {
            const users = [finding.auditee, ...finding.responders.map((r) => r.user)];
            for (const user of users) {
                const entry = byUser.get(user.id) ?? { email: user.email, findings: [] };
                if (!entry.findings.some((f) => f.id === finding.id)) {
                    entry.findings.push({ id: finding.id, title: finding.title, dueDate: finding.due_date.toISOString().slice(0, 10) });
                }
                byUser.set(user.id, entry);
            }
        }
        const title = stage === 'draft' ? 'Findings awaiting your response' : 'Audit findings assigned';
        const subject = stage === 'draft'
            ? `Findings awaiting your response: ${engagementReference}`
            : `Audit findings assigned: ${engagementReference}`;
        for (const [userId, entry] of byUser) {
            const single = entry.findings.length === 1 ? entry.findings[0] : null;
            const action = stage === 'draft'
                ? 'Please submit your management response before the audit report is issued.'
                : 'Please review them and submit your management responses.';
            const body = single
                ? `Finding "${single.title}" (${engagementReference}) has been assigned to you. Due ${single.dueDate}. ${stage === 'draft' ? action : ''}`.trim()
                : `${entry.findings.length} findings from audit ${engagementReference} have been assigned to you. ${action}`;
            await notification_queue_service_1.notificationQueueService.enqueueSafe('in_app', {
                userId,
                title,
                body,
                type: 'warning',
                referenceType: single ? 'audit_finding' : 'audit_engagement',
                referenceId: single ? single.id : engagementId,
            });
            if (entry.email) {
                await notification_queue_service_1.notificationQueueService.enqueueSafe('email', { to: entry.email, subject, text: body });
            }
        }
    }
    catch (err) {
        logger_util_1.logger.warn('Finding responder notification failed', { engagementId, stage, err });
    }
};
exports.notifyFindingResponders = notifyFindingResponders;
//# sourceMappingURL=finding-responder-notify.utility.js.map