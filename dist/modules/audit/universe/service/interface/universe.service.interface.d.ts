import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { CreateUniverseRequestDto, UpdateUniverseRequestDto, UniverseQueryDto } from '../../dto/request/universe.request.dto';
import { UniverseResponseDto } from '../../dto/response/universe.response.dto';
export interface IUniverseService {
    createEntity(dto: CreateUniverseRequestDto, actor: ActorContext): Promise<UniverseResponseDto>;
    updateEntity(id: string, dto: UpdateUniverseRequestDto, actor: ActorContext): Promise<UniverseResponseDto>;
    deactivateEntity(id: string, actor: ActorContext): Promise<void>;
    getEntityById(id: string, actor: ActorContext): Promise<UniverseResponseDto>;
    listEntities(query: UniverseQueryDto): Promise<{
        entities: UniverseResponseDto[];
        meta: PaginationMeta;
    }>;
}
//# sourceMappingURL=universe.service.interface.d.ts.map