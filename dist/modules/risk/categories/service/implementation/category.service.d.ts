import { RiskActorContext } from '../../../domain/entity/risk.entity';
import { CreateRiskCategoryRequestDto, RiskCategoryQueryDto, UpdateRiskCategoryRequestDto } from '../../dto/request/category.request.dto';
import { RiskCategoryResponseDto } from '../../dto/response/category.response.dto';
import { ICategoryService } from '../interface/category.service.interface';
export declare class CategoryService implements ICategoryService {
    createCategory(dto: CreateRiskCategoryRequestDto, actor: RiskActorContext): Promise<RiskCategoryResponseDto>;
    updateCategory(id: string, dto: UpdateRiskCategoryRequestDto, actor: RiskActorContext): Promise<RiskCategoryResponseDto>;
    deactivateCategory(id: string, actor: RiskActorContext): Promise<void>;
    listCategories(filters: RiskCategoryQueryDto): Promise<RiskCategoryResponseDto[]>;
    private _assertCategoryExists;
}
//# sourceMappingURL=category.service.d.ts.map