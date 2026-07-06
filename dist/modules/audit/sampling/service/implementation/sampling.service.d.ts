import { ActorContext } from '../../../domain/entity/audit.entity';
import { IEvidenceService } from '../../../evidence/service/interface/evidence.service.interface';
import { RunSamplingRequestDto } from '../../dto/request/sampling.request.dto';
import { ISamplingService, SamplingRunFile, SamplingRunResultDto } from '../interface/sampling.service.interface';
/**
 * Audit sampling: parses an uploaded population CSV, draws a reproducible
 * sample (recorded seed), stores BOTH files as engagement evidence, and
 * produces a methodology write-up ready to paste into a working paper.
 * The evidence trail (population + sample + seed) is what makes the selection
 * defensible when a reviewer or regulator asks "how did you pick these?".
 */
export declare class SamplingService implements ISamplingService {
    private readonly evidenceService;
    constructor(evidenceService: IEvidenceService);
    runSampling(engagementId: string, file: SamplingRunFile, dto: RunSamplingRequestDto, actor: ActorContext): Promise<SamplingRunResultDto>;
    private _parsePopulation;
    private _buildMethodology;
}
//# sourceMappingURL=sampling.service.d.ts.map