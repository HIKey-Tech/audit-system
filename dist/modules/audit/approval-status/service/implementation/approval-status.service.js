"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalStatusService = exports.ApprovalStatusService = void 0;
const audit_enum_1 = require("../../../domain/enum/audit.enum");
class ApprovalStatusService {
    async markApproved(tx, entityType, entityId, approverId, approvedAt) {
        if (entityType === 'audit_plan') {
            await tx.audit_Plan.update({
                where: { id: entityId },
                data: {
                    status: audit_enum_1.PlanStatus.Approved,
                    approved_by_id: approverId,
                    approved_at: approvedAt,
                    rejection_reason: null,
                },
            });
            return;
        }
        if (entityType === 'audit_working_paper') {
            await tx.audit_Working_Paper.update({
                where: { id: entityId },
                data: {
                    status: audit_enum_1.WorkingPaperStatus.Approved,
                    reviewed_by_id: approverId,
                    rejection_reason: null,
                },
            });
            return;
        }
        if (entityType === 'audit_finding_closure') {
            await tx.audit_Finding.update({
                where: { id: entityId },
                data: {
                    status: audit_enum_1.FindingStatus.Closed,
                    closed_by_id: approverId,
                    closed_at: approvedAt,
                },
            });
            return;
        }
        await tx.audit_Report.update({
            where: { id: entityId },
            data: { status: audit_enum_1.ReportStatus.Approved },
        });
    }
    async markRejected(tx, entityType, entityId, approverId, reason) {
        if (entityType === 'audit_plan') {
            await tx.audit_Plan.update({
                where: { id: entityId },
                data: {
                    status: audit_enum_1.PlanStatus.Rejected,
                    approved_by_id: null,
                    approved_at: null,
                    rejection_reason: reason,
                },
            });
            return;
        }
        if (entityType === 'audit_working_paper') {
            await tx.audit_Working_Paper.update({
                where: { id: entityId },
                data: {
                    status: audit_enum_1.WorkingPaperStatus.Rejected,
                    reviewed_by_id: approverId,
                    rejection_reason: reason,
                },
            });
            return;
        }
        if (entityType === 'audit_finding_closure') {
            await tx.audit_Finding.update({
                where: { id: entityId },
                data: {
                    status: audit_enum_1.FindingStatus.Verified,
                    closed_by_id: null,
                    closed_at: null,
                },
            });
            return;
        }
        await tx.audit_Report.update({
            where: { id: entityId },
            data: {
                status: audit_enum_1.ReportStatus.Rejected,
                rejection_reason: reason,
            },
        });
    }
}
exports.ApprovalStatusService = ApprovalStatusService;
exports.approvalStatusService = new ApprovalStatusService();
//# sourceMappingURL=approval-status.service.js.map