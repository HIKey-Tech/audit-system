import { RiskActorContext } from '../../../domain/entity/risk.entity';
import { CreateRiskCategoryRequestDto, RiskCategoryQueryDto, UpdateRiskCategoryRequestDto } from '../../dto/request/category.request.dto';
import { RiskCategoryResponseDto } from '../../dto/response/category.response.dto';
export interface ICategoryService {
    createCategory(dto: CreateRiskCategoryRequestDto, actor: RiskActorContext): Promise<RiskCategoryResponseDto>;
    updateCategory(id: string, dto: UpdateRiskCategoryRequestDto, actor: RiskActorContext): Promise<RiskCategoryResponseDto>;
    deactivateCategory(id: string, actor: RiskActorContext): Promise<void>;
    listCategories(filters: RiskCategoryQueryDto): Promise<RiskCategoryResponseDto[]>;
}
//# sourceMappingURL=category.service.interface.d.ts.map