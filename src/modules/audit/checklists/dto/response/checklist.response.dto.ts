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

export const mapChecklistToResponse = (item: {
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
}): ChecklistResponseDto => ({
  id: item.id,
  engagementId: item.engagement_id,
  auditType: item.audit_type,
  controlReference: item.control_reference,
  controlDescription: item.control_description,
  testProcedure: item.test_procedure,
  result: item.result,
  notes: item.notes,
  evidenceId: item.evidence_id,
  testedById: item.tested_by_id,
  testedAt: item.tested_at?.toISOString() ?? null,
  createdAt: item.created_at.toISOString(),
  updatedAt: item.updated_at.toISOString(),
});
