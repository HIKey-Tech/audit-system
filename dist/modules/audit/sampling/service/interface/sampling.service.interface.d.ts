import { ActorContext } from '../../../domain/entity/audit.entity';
import { RunSamplingRequestDto } from '../../dto/request/sampling.request.dto';
export interface SamplingRunFile {
    originalName: string;
    mimeType: string;
    fileSize: number;
    buffer: Buffer;
}
export interface SamplingRunResultDto {
    populationEvidenceId: string;
    sampleEvidenceId: string;
    populationCount: number;
    sampleCount: number;
    method: string;
    seed: number;
    /** Ready-to-paste working-paper section documenting the selection. */
    methodologyMarkdown: string;
    /** First rows of the sample for on-screen confirmation. */
    previewRows: Record<string, unknown>[];
    previewColumns: string[];
}
export interface ISamplingService {
    runSampling(engagementId: string, file: SamplingRunFile, dto: RunSamplingRequestDto, actor: ActorContext): Promise<SamplingRunResultDto>;
}
//# sourceMappingURL=sampling.service.interface.d.ts.map