"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidatePlanningRecommendationsCache = exports.setCachedRecommendations = exports.getCachedRecommendations = void 0;
let recommendationsCache = null;
const RECOMMENDATIONS_TTL_MS = 60_000;
const getCachedRecommendations = () => {
    if (recommendationsCache && Date.now() - recommendationsCache.at < RECOMMENDATIONS_TTL_MS) {
        return recommendationsCache.data;
    }
    return null;
};
exports.getCachedRecommendations = getCachedRecommendations;
const setCachedRecommendations = (data) => {
    recommendationsCache = { at: Date.now(), data };
};
exports.setCachedRecommendations = setCachedRecommendations;
const invalidatePlanningRecommendationsCache = () => {
    recommendationsCache = null;
};
exports.invalidatePlanningRecommendationsCache = invalidatePlanningRecommendationsCache;
//# sourceMappingURL=recommendations-cache.utility.js.map