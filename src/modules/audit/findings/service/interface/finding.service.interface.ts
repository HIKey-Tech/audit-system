import { ActorContext } from '../../../domain/entity/audit.entity';
import { FindingStatus } from '../../../domain/enum/audit.enum';
import {
  CreateFindingRequestDto,
  FindingQueryDto,
  UpdateFindingRequestDto,
} from '../../dto/request/finding.request.dto';
import { FindingResponseDto } from '../../dto/response/finding.response.dto';

export interface IFindingService {
  createFinding(engagementId: string, dto: CreateFindingRequestDto, actor: ActorContext): Promise<FindingResponseDto>;
  updateFinding(id: string, dto: UpdateFindingRequestDto, actor: ActorContext): Promise<FindingResponseDto>;
  updateFindingStatus(id: string, newStatus: FindingStatus, actor: ActorContext): Promise<FindingResponseDto>;
  closeFinding(id: string, actor: ActorContext): Promise<FindingResponseDto>;
  getFindingById(id: string, actor: ActorContext): Promise<FindingResponseDto>;
  listFindings(engagementId: string, query: FindingQueryDto, actor: ActorContext): Promise<FindingResponseDto[]>;
}
