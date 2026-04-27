export interface ChecklistResponseDto {
    id: string;
    engagementId: string;
    auditType: string;
    controlReference: string;
    controlDescription: string;
    testProcedure: string;
    result: string;
    notes: string | null;
    evidenceId: string | null;
    testedById: string | null;
    testedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export declare const mapChecklistToResponse: (item: {
    id: string;
    engagement_id: string;
    audit_type: string;
    control_reference: string;
    control_description: string;
    test_procedure: string;
    result: string;
    notes: string | null;
    evidence_id: string | null;
    tested_by_id: string | null;
    tested_at: Date | null;
    created_at: Date;
    updated_at: Date;
}) => ChecklistResponseDto;
//# sourceMappingURL=checklist.response.dto.d.ts.map