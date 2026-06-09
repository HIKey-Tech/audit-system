import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { RiskActorContext } from '../../../domain/entity/risk.entity';
import { assertHasPermission } from '../../../utility/risk.utility';
import {
  CreateRiskCategoryRequestDto,
  RiskCategoryQueryDto,
  UpdateRiskCategoryRequestDto,
} from '../../dto/request/category.request.dto';
import {
  RiskCategoryResponseDto,
  mapRiskCategoryToResponse,
} from '../../dto/response/category.response.dto';
import { ICategoryService } from '../interface/category.service.interface';

export class CategoryService implements ICategoryService {
  async createCategory(
    dto: CreateRiskCategoryRequestDto,
    actor: RiskActorContext,
  ): Promise<RiskCategoryResponseDto> {
    assertHasPermission(actor.permissions, 'risk_category:write');

    const existing = await prisma.risk_Category.findUnique({
      where: { name: dto.name },
      select: { id: true },
    });
    if (existing) {
      throw AppError.conflict(`Risk category '${dto.name}' already exists`);
    }

    const category = await prisma.risk_Category.create({
      data: {
        name: dto.name,
        description: dto.description,
        created_by_id: actor.id,
      },
    });

    logger.info('Risk category created', { categoryId: category.id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'risk.category.create',
      module: 'risk',
      entityType: 'risk_category',
      entityId: category.id,
      newValues: mapRiskCategoryToResponse(category),
    });

    return mapRiskCategoryToResponse(category);
  }

  async updateCategory(
    id: string,
    dto: UpdateRiskCategoryRequestDto,
    actor: RiskActorContext,
  ): Promise<RiskCategoryResponseDto> {
    assertHasPermission(actor.permissions, 'risk_category:write');
    await this._assertCategoryExists(id);

    const category = await prisma.risk_Category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
      },
    });

    logger.info('Risk category updated', { categoryId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'risk.category.update',
      module: 'risk',
      entityType: 'risk_category',
      entityId: id,
      newValues: mapRiskCategoryToResponse(category),
    });

    return mapRiskCategoryToResponse(category);
  }

  async deactivateCategory(id: string, actor: RiskActorContext): Promise<void> {
    assertHasPermission(actor.permissions, 'risk_category:delete');
    await this._assertCategoryExists(id);

    await prisma.risk_Category.update({
      where: { id },
      data: { is_active: false },
    });

    logger.info('Risk category deactivated', { categoryId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'risk.category.deactivate',
      module: 'risk',
      entityType: 'risk_category',
      entityId: id,
    });
  }

  async listCategories(filters: RiskCategoryQueryDto): Promise<RiskCategoryResponseDto[]> {
    const where: Prisma.Risk_CategoryWhereInput = {
      ...(filters.isActive !== undefined && { is_active: filters.isActive }),
    };

    const categories = await prisma.risk_Category.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return categories.map(mapRiskCategoryToResponse);
  }

  private async _assertCategoryExists(id: string): Promise<void> {
    const category = await prisma.risk_Category.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!category) throw AppError.notFound('Risk category');
  }
}
