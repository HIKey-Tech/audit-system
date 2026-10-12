import { ImocTicket, ImocIngestionRunSummary } from '../../domain/entity/imoc.entity';
import {
  CreateImocRuleDto,
  UpdateImocRuleDto,
} from '../../dto/request/imoc.request.dto';
import {
  ImocIngestionRuleResponseDto,
  ImocIngestionRunResponseDto,
} from '../../dto/response/imoc.response.dto';

export interface IImocIngestionService {
  runIngestion(
    trigger: 'scheduled' | 'manual',
    actorId?: string,
  ): Promise<ImocIngestionRunSummary>;

  listRules(): Promise<ImocIngestionRuleResponseDto[]>;

  getRule(id: string): Promise<ImocIngestionRuleResponseDto>;

  createRule(
    actorId: string,
    data: CreateImocRuleDto,
  ): Promise<ImocIngestionRuleResponseDto>;

  updateRule(
    actorId: string,
    id: string,
    data: UpdateImocRuleDto,
  ): Promise<ImocIngestionRuleResponseDto>;

  toggleRule(actorId: string, id: string): Promise<ImocIngestionRuleResponseDto>;

  deleteRule(actorId: string, id: string): Promise<void>;

  previewRule(
    criteria: unknown,
    lookbackDays?: number,
  ): Promise<{ total: number; sample: ImocTicket[] }>;

  listRuns(
    page?: number,
    pageSize?: number,
  ): Promise<{
    items: ImocIngestionRunResponseDto[];
    total: number;
    page: number;
    pageSize: number;
  }>;

  getRun(id: string): Promise<ImocIngestionRunResponseDto>;
}
