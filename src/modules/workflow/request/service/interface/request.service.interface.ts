import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { WorkflowActorContext } from '../../../domain/entity/workflow.entity';
import {
  ApproveRequestDto,
  CommentRequestDto,
  CreateRequestDto,
  RejectRequestDto,
  RequestInboxQueryDto,
  RequestListQueryDto,
  SignRequestDto,
} from '../../dto/request/request.request.dto';
import {
  RequestAttachmentDto,
  RequestResponseDto,
  SignatureVerificationDto,
} from '../../dto/response/request.response.dto';

export interface UploadRequestAttachmentInput {
  originalName: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
}

export interface IRequestService {
  createRequest(dto: CreateRequestDto, actor: WorkflowActorContext): Promise<RequestResponseDto>;
  addAttachment(
    requestId: string,
    file: UploadRequestAttachmentInput,
    actor: WorkflowActorContext,
  ): Promise<RequestAttachmentDto>;

  approve(requestId: string, actor: WorkflowActorContext, dto: ApproveRequestDto): Promise<RequestResponseDto>;
  sign(requestId: string, actor: WorkflowActorContext, dto: SignRequestDto): Promise<RequestResponseDto>;
  reject(requestId: string, actor: WorkflowActorContext, dto: RejectRequestDto): Promise<RequestResponseDto>;
  comment(requestId: string, actor: WorkflowActorContext, dto: CommentRequestDto): Promise<RequestResponseDto>;
  cancel(requestId: string, actor: WorkflowActorContext): Promise<RequestResponseDto>;

  getById(requestId: string, actor: WorkflowActorContext): Promise<RequestResponseDto>;
  list(
    query: RequestListQueryDto,
    actor: WorkflowActorContext,
  ): Promise<{ requests: RequestResponseDto[]; meta: PaginationMeta }>;
  inbox(
    query: RequestInboxQueryDto,
    actor: WorkflowActorContext,
  ): Promise<{ requests: RequestResponseDto[]; meta: PaginationMeta }>;
  getCandidates(actor: WorkflowActorContext): Promise<RequestAttachmentCandidate[]>;
  verifySignatures(requestId: string, actor: WorkflowActorContext): Promise<SignatureVerificationDto[]>;
}

export interface RequestAttachmentCandidate {
  id: string;
  displayName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
}
