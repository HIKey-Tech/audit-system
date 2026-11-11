import { PlanningRecommendationDto } from '../service/interface/planning.service.interface';

let recommendationsCache: { at: number; data: PlanningRecommendationDto[] } | null = null;
const RECOMMENDATIONS_TTL_MS = 60_000;

export const getCachedRecommendations = (): PlanningRecommendationDto[] | null => {
  if (recommendationsCache && Date.now() - recommendationsCache.at < RECOMMENDATIONS_TTL_MS) {
    return recommendationsCache.data;
  }
  return null;
};

export const setCachedRecommendations = (data: PlanningRecommendationDto[]): void => {
  recommendationsCache = { at: Date.now(), data };
};

export const invalidatePlanningRecommendationsCache = (): void => {
  recommendationsCache = null;
};

