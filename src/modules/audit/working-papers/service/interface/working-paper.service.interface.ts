import { ActorContext, ExportedAuditFile } from '../../../domain/entity/audit.entity';
import {
  CreateWorkingPaperRequestDto,
  UpdateWorkingPaperRequestDto,
} from '../../dto/request/working-paper.request.dto';
import { WorkingPaperResponseDto } from '../../dto/response/working-paper.response.dto';

export interface IWorkingPaperService {
  createWorkingPaper(engagementId: string, dto: CreateWorkingPaperRequestDto, actor: ActorContext): Promise<WorkingPaperResponseDto>;
  updateWorkingPaper(id: string, dto: UpdateWorkingPaperRequestDto, actor: ActorContext): Promise<WorkingPaperResponseDto>;
  submitWorkingPaper(id: string, actor: ActorContext): Promise<WorkingPaperResponseDto>;
  approveWorkingPaper(id: string, actor: ActorContext): Promise<WorkingPaperResponseDto>;
  rejectWorkingPaper(id: string, reason: string, actor: ActorContext): Promise<WorkingPaperResponseDto>;
  getWorkingPaperById(id: string): Promise<WorkingPaperResponseDto>;
  listWorkingPapers(engagementId: string): Promise<WorkingPaperResponseDto[]>;
  exportWorkingPaper(id: string): Promise<ExportedAuditFile>;
}
