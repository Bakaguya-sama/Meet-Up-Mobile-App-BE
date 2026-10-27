export interface PlaceCategoryMapping {
  internalCategory: string;
  textQuery: string;
  includedType: string;
  candidateTags: string[];
  supportsOpenAtRequestTime: boolean;
}

export interface RecommendationConfig {
  version: string;
  providerMappingVersion: string;
  maxTopK: number;
  maxSearchRadiusMeters: number;
  candidateTargetCount: number;
  candidateMaxCount: number;
  providerCallBudget: number;
  maxRequiredCategories: number;
  categoryMappings: readonly PlaceCategoryMapping[];
}

export const RECOMMENDATION_CONFIG_DEV_V1: RecommendationConfig = {
  version: 'recommendation-config-dev-v1',
  providerMappingVersion: 'google-place-category-map-v1',
  maxTopK: 5,
  maxSearchRadiusMeters: 10_000,
  candidateTargetCount: 20,
  candidateMaxCount: 30,
  providerCallBudget: 4,
  maxRequiredCategories: 3,
  categoryMappings: [
    ['bar', 'bar', 'bar'],
    ['cafe', 'cafe', 'cafe'],
    ['movie_theater', 'movie theater', 'movie_theater'],
    ['park', 'park', 'park'],
    ['restaurant', 'restaurant', 'restaurant'],
  ].map(([internalCategory, textQuery, includedType]) => ({
    internalCategory,
    textQuery,
    includedType,
    candidateTags: [internalCategory],
    supportsOpenAtRequestTime: true,
  })),
};
