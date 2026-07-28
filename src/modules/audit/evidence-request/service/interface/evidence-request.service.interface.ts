import { ActorContext } from '../../../domain/entity/audit.entity';
import { CreateEvidenceRequestDto } from '../../dto/request/evidence-request.request.dto';
import { AssignableUserDto, EvidenceRequestResponseDto } from '../../dto/response/evidence-request.response.dto';

export interface RespondFileDto {
  originalName: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
}

export interface IEvidenceRequestService {
  createRequest(engagementId: string, dto: CreateEvidenceRequestDto, actor: ActorContext): Promise<EvidenceRequestResponseDto>;
  listAssignableUsers(engagementId: string, actor: ActorContext): Promise<AssignableUserDto[]>;
  listForEngagement(engagementId: string, actor: ActorContext): Promise<EvidenceRequestResponseDto[]>;
  listMine(actor: ActorContext): Promise<EvidenceRequestResponseDto[]>;
  respond(requestId: string, file: RespondFileDto, actor: ActorContext): Promise<EvidenceRequestResponseDto>;
  accept(requestId: string, actor: ActorContext): Promise<EvidenceRequestResponseDto>;
  returnRequest(requestId: string, reason: string, actor: ActorContext): Promise<EvidenceRequestResponseDto>;
  cancelRequest(requestId: string, actor: ActorContext): Promise<void>;
}
