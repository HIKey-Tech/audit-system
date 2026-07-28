import { Prisma } from '@prisma/client';

export const evidenceRequestInclude = Prisma.validator<Prisma.Audit_Evidence_RequestInclude>()({
  requested_by: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true } },
  assigned_to: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true } },
  evidence: { select: { id: true, file_name: true, uploaded_at: true }, orderBy: { uploaded_at: 'desc' } },
  engagement: { select: { reference_number: true, title: true } },
});

export type EvidenceRequestWithDetails = Prisma.Audit_Evidence_RequestGetPayload<{
  include: typeof evidenceRequestInclude;
}>;

export interface EvidenceRequestResponseDto {
  id: string;
  engagementId: string;
  engagementReference: string;
  engagementTitle: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  returnReason: string | null;
  requestedById: string;
  requestedByName: string;
  assignedToId: string;
  assignedToName: string;
  fulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
  evidence: { id: string; fileName: string; uploadedAt: string }[];
}

/** A person an evidence request can be assigned to (who will upload the document). */
export interface AssignableUserDto {
  id: string;
  displayName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  /** True for the engagement's default auditee. */
  isAuditee: boolean;
}

const userName = (u: { display_name: string | null; first_name: string; last_name: string }): string =>
  u.display_name ?? `${u.first_name} ${u.last_name}`.trim();

export const mapEvidenceRequestToResponse = (r: EvidenceRequestWithDetails): EvidenceRequestResponseDto => ({
  id: r.id,
  engagementId: r.engagement_id,
  engagementReference: r.engagement.reference_number,
  engagementTitle: r.engagement.title,
  title: r.title,
  description: r.description,
  dueDate: r.due_date?.toISOString() ?? null,
  status: r.status,
  returnReason: r.return_reason,
  requestedById: r.requested_by_id,
  requestedByName: userName(r.requested_by),
  assignedToId: r.assigned_to_id,
  assignedToName: userName(r.assigned_to),
  fulfilledAt: r.fulfilled_at?.toISOString() ?? null,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
  evidence: r.evidence.map((e) => ({ id: e.id, fileName: e.file_name, uploadedAt: e.uploaded_at.toISOString() })),
});
