import { createHash } from 'node:crypto';
import { RecommendationError } from '../../domain/recommendation.error';
import type { CreateRecommendationRunRequest } from '../dto/recommendation-run.dto';
import type { RecommendationConfig } from '../recommendation-config';

export interface ValidatedRecommendationRequest {
  requestId: string;
  meetupId: string;
  topK: number;
  requiredCategories: string[];
  openingFilter: 'ANY' | 'OPEN_AT_REQUEST_TIME' | 'OPEN_AT_SCHEDULED_TIME';
  searchRadiusMeters: number;
  payloadHash: string;
}

export function validateRecommendationRequest(
  input: CreateRecommendationRunRequest,
  meetupId: string,
  config: RecommendationConfig,
): ValidatedRecommendationRequest {
  if (!input.requestId) {
    throw new RecommendationError(
      'INVALID_RECOMMENDATION_REQUEST',
      'Idempotency-Key must be a UUID v4',
    );
  }
  const categories = [
    ...new Set(input.filters.categories.map((value) => value.toLowerCase())),
  ].sort();
  if (
    categories.length !== input.filters.categories.length ||
    categories.length > config.maxRequiredCategories
  ) {
    throw new RecommendationError(
      'INVALID_RECOMMENDATION_REQUEST',
      'Categories must be unique and within the configured limit',
    );
  }
  const mappings = new Map(
    config.categoryMappings.map((mapping) => [
      mapping.internalCategory,
      mapping,
    ]),
  );
  for (const category of categories) {
    const mapping = mappings.get(category);
    if (!mapping) {
      throw new RecommendationError(
        'INVALID_RECOMMENDATION_REQUEST',
        `Category ${category} is not supported by the active provider mapping`,
      );
    }
    if (
      input.filters.openingFilter === 'OPEN_AT_REQUEST_TIME' &&
      !mapping.supportsOpenAtRequestTime
    ) {
      throw new RecommendationError(
        'UNSUPPORTED_OPENING_FILTER_FOR_CATEGORY',
        `Category ${category} does not support open-at-request-time filtering`,
      );
    }
  }
  if (
    input.topK > config.maxTopK ||
    input.filters.radiusMeters > config.maxSearchRadiusMeters
  ) {
    throw new RecommendationError(
      'INVALID_RECOMMENDATION_REQUEST',
      'Request exceeds the configured limit',
    );
  }
  const canonical = {
    topK: input.topK,
    categories,
    openingFilter: input.filters.openingFilter,
    radiusMeters: input.filters.radiusMeters,
  };
  return {
    requestId: input.requestId.toLowerCase(),
    meetupId: meetupId.toLowerCase(),
    topK: input.topK,
    requiredCategories: categories,
    openingFilter: input.filters.openingFilter,
    searchRadiusMeters: input.filters.radiusMeters,
    payloadHash: createHash('sha256')
      .update(JSON.stringify(canonical))
      .digest('hex'),
  };
}
