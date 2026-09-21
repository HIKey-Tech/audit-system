import { ActorContext } from '../../../audit/domain/entity/audit.entity';

export type WarehouseEntityType =
  | 'audit_engagement'
  | 'audit_finding'
  | 'audit_evidence_request';

export interface WarehouseSnapshotCaptureResult {
  snapshotDate: string;
  engagementSnapshots: number;
  findingSnapshots: number;
  evidenceRequestSnapshots: number;
  outcomesRecorded: number;
}

export interface WarehouseSnapshotStatus {
  snapshotCount: number;
  lastSnapshotAt: string | null;
}

export interface WarehouseEngagementSignal {
  id: string;
  referenceNumber: string;
  title: string;
  status: string;
  plannedStartDate: Date;
  actualStartDate: Date | null;
  slaDeadline: Date;
  checklistTotal: number;
  checklistTested: number;
  workingPaperTotal: number;
  workingPaperApproved: number;
  openEvidenceRequests: number;
  plannedHours: number | null;
  actualHours: number;
}

export interface WarehouseFindingSignal {
  id: string;
  title: string;
  status: string;
  severity: string;
  dueDate: Date;
  hasManagementResponse: boolean;
  hasRemediationEvidence: boolean;
}

export interface WarehouseEvidenceRequestSignal {
  id: string;
  title: string;
  status: string;
  dueDate: Date | null;
}

export interface WarehouseInsightTarget {
  entityType: WarehouseEntityType;
  entityId: string;
}

export interface WarehouseInsightTargetDetail extends WarehouseInsightTarget {
  engagementId: string;
  actionUrl: string;
  teamUserIds: string[];
  auditeeUserIds: string[];
  evidenceRequestAssigneeId: string | null;
  reportIssued: boolean;
}

export interface WarehouseNextActionCandidate {
  type: 'submit_management_response' | 'upload_remediation_evidence' | 'provide_evidence' | 'start_fieldwork' | 'continue_control_testing' | 'revise_working_paper';
  entityType: WarehouseEntityType | 'audit_working_paper';
  entityId: string;
  title: string;
  description: string;
  dueAt: Date | null;
  priority: 'high' | 'medium' | 'low';
  actionUrl: string;
}

export interface IWarehouseService {
  capturePredictiveSnapshots(): Promise<WarehouseSnapshotCaptureResult>;
  getSnapshotStatus(): Promise<WarehouseSnapshotStatus>;
  getEngagementSignals(): Promise<WarehouseEngagementSignal[]>;
  getFindingSignals(): Promise<WarehouseFindingSignal[]>;
  getEvidenceRequestSignals(): Promise<WarehouseEvidenceRequestSignal[]>;
  getInsightTargetDetails(targets: WarehouseInsightTarget[]): Promise<WarehouseInsightTargetDetail[]>;
  getNextActionCandidates(actor: ActorContext): Promise<WarehouseNextActionCandidate[]>;
}
