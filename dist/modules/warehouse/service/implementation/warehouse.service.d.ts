import { IWarehouseService, WarehouseEngagementSignal, WarehouseEvidenceRequestSignal, WarehouseFindingSignal, WarehouseInsightTarget, WarehouseInsightTargetDetail, WarehouseNextActionCandidate, WarehouseSnapshotCaptureResult, WarehouseSnapshotStatus } from '../interface/warehouse.service.interface';
import { ActorContext } from '../../../audit/domain/entity/audit.entity';
/**
 * The warehouse is an internal, computed read-store for the predictive module.
 * It reads from IAMS' own database only and intentionally keeps document
 * content, request bodies and user contact details out of feature snapshots.
 */
export declare class WarehouseService implements IWarehouseService {
    capturePredictiveSnapshots(): Promise<WarehouseSnapshotCaptureResult>;
    getSnapshotStatus(): Promise<WarehouseSnapshotStatus>;
    getEngagementSignals(): Promise<WarehouseEngagementSignal[]>;
    getFindingSignals(): Promise<WarehouseFindingSignal[]>;
    getEvidenceRequestSignals(): Promise<WarehouseEvidenceRequestSignal[]>;
    getInsightTargetDetails(targets: WarehouseInsightTarget[]): Promise<WarehouseInsightTargetDetail[]>;
    getNextActionCandidates(actor: ActorContext): Promise<WarehouseNextActionCandidate[]>;
    private _upsertSnapshots;
    private _recordOutcomes;
}
export declare const warehouseService: WarehouseService;
//# sourceMappingURL=warehouse.service.d.ts.map