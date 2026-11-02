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
  routeElementLimit: number;
  tauSeconds: number;
  preferenceScores: Readonly<Record<'high' | 'normal' | 'avoid', number>>;
  tagWeights: Readonly<Record<string, number>>;
  pMissing: number;
  qMissing: number;
  qualityReviewReference: number;
  utilityWeights: { travel: number; preference: number; quality: number };
  monteCarloSamples: number;
  utilityTieEpsilon: number;
  randomAlgorithm: 'mulberry32-v1';
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
  routeElementLimit: 625,
  tauSeconds: 1200,
  preferenceScores: { high: 1, normal: 0.6, avoid: 0.1 },
  tagWeights: {},
  pMissing: 0.6,
  qMissing: 0.6,
  qualityReviewReference: 999,
  utilityWeights: { travel: 0.6, preference: 0.3, quality: 0.1 },
  monteCarloSamples: 1000,
  utilityTieEpsilon: 0.000001,
  randomAlgorithm: 'mulberry32-v1',
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
