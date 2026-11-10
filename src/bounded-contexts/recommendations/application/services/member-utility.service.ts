import { RecommendationError } from '../../domain/recommendation.error';
import type { RecommendationConfig } from '../recommendation-config';

export type PreferenceLevel = 'high' | 'normal' | 'avoid';

export interface MemberFeatureInput {
  participantId: string;
  canonicalCandidateKey: string;
  etaSeconds: number;
  distanceMeters: number;
  staticDurationSeconds?: number;
  placeTags: string[];
  preferences: Array<{ tagCode: string; level: PreferenceLevel }>;
  rating0To5: number | null;
  userRatingCount: number | null;
}

export interface MemberFeature extends MemberFeatureInput {
  matchedTags: Array<{
    tagCode: string;
    level: PreferenceLevel;
    weight: number;
  }>;
  missingFlags: string[];
  travelUtility: number;
  preferenceUtility: number;
  placeQualityUtility: number;
  memberUtility: number;
}

export class MemberUtilityService {
  constructor(private readonly config: RecommendationConfig) {
    validateUtilityConfig(config);
  }

  score(input: MemberFeatureInput): MemberFeature {
    assertNonNegative(input.etaSeconds, 'etaSeconds');
    assertNonNegative(input.distanceMeters, 'distanceMeters');
    const travelUtility = Math.exp(-input.etaSeconds / this.config.tauSeconds);
    const preferenceByTag = new Map(
      input.preferences.map((value) => [value.tagCode, value.level] as const),
    );
    const matchedTags = [...new Set(input.placeTags)]
      .sort()
      .flatMap((tagCode) => {
        const level = preferenceByTag.get(tagCode);
        if (!level) return [];
        const weight = this.config.tagWeights[tagCode] ?? 1;
        if (!Number.isFinite(weight) || weight <= 0) invalidConfig();
        return [{ tagCode, level, weight }];
      });
    const preferenceUtility = matchedTags.length
      ? matchedTags.reduce(
          (sum, tag) =>
            sum + this.config.preferenceScores[tag.level] * tag.weight,
          0,
        ) / matchedTags.reduce((sum, tag) => sum + tag.weight, 0)
      : this.config.pMissing;
    const hasQualityInput =
      input.rating0To5 !== null && input.userRatingCount !== null;
    if (
      hasQualityInput &&
      (!Number.isFinite(input.rating0To5) ||
        input.rating0To5! < 0 ||
        input.rating0To5! > 5 ||
        !Number.isInteger(input.userRatingCount) ||
        input.userRatingCount! < 0)
    ) {
      invalidNumeric();
    }
    const hasValidQuality = hasQualityInput;
    const placeQualityUtility = hasValidQuality
      ? (input.rating0To5! / 5) *
        Math.min(
          1,
          Math.log1p(input.userRatingCount!) /
            Math.log1p(this.config.qualityReviewReference),
        )
      : this.config.qMissing;
    const { travel, preference, quality } = this.config.utilityWeights;
    const memberUtility =
      travel * travelUtility +
      preference * preferenceUtility +
      quality * placeQualityUtility;
    for (const value of [
      travelUtility,
      preferenceUtility,
      placeQualityUtility,
      memberUtility,
    ]) {
      if (!Number.isFinite(value) || value < 0 || value > 1) invalidNumeric();
    }
    return {
      ...input,
      matchedTags,
      missingFlags: [
        ...(matchedTags.length ? [] : ['PREFERENCE']),
        ...(hasValidQuality ? [] : ['PLACE_QUALITY']),
      ],
      travelUtility,
      preferenceUtility,
      placeQualityUtility,
      memberUtility,
    };
  }
}

/** Named scoring boundary from the versioned Step 2 architecture. */
export class MemberUtilityScorer extends MemberUtilityService {}

export function validateUtilityConfig(config: RecommendationConfig): void {
  const probabilities = [
    ...Object.values(config.preferenceScores),
    config.pMissing,
    config.qMissing,
  ];
  if (
    !Number.isFinite(config.tauSeconds) ||
    config.tauSeconds <= 0 ||
    !Number.isFinite(config.qualityReviewReference) ||
    config.qualityReviewReference <= 0 ||
    probabilities.some(
      (value) => !Number.isFinite(value) || value < 0 || value > 1,
    ) ||
    Object.values(config.tagWeights).some(
      (value) => !Number.isFinite(value) || value <= 0,
    ) ||
    !Number.isInteger(config.monteCarloSamples) ||
    config.monteCarloSamples <= 0 ||
    !Number.isFinite(config.utilityTieEpsilon) ||
    config.utilityTieEpsilon <= 0
  ) {
    invalidConfig();
  }
  const weights = Object.values(config.utilityWeights);
  if (
    weights.some((value) => !Number.isFinite(value) || value < 0) ||
    Math.abs(weights.reduce((sum, value) => sum + value, 0) - 1) > 1e-9
  ) {
    invalidConfig();
  }
}

function assertNonNegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RecommendationError(
      'INVALID_RECOMMENDATION_NUMERIC',
      `${name} must be finite and non-negative`,
    );
  }
}

function invalidConfig(): never {
  throw new RecommendationError(
    'INVALID_RECOMMENDATION_CONFIG',
    'Recommendation utility configuration is invalid',
  );
}

function invalidNumeric(): never {
  throw new RecommendationError(
    'INVALID_RECOMMENDATION_NUMERIC',
    'Recommendation utility is outside [0,1]',
  );
}
