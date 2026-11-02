import type {
  RecommendationContextStatus,
  ScheduledOpeningEvidence,
  ScheduledOpeningStatus,
} from './temporal-context';

export type RecommendationRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

export const LEGACY_TEMPORAL_PROVIDER_OPTIONS_VERSION =
  'legacy-pre-temporal-v1';

export interface RecommendationRun {
  id: string;
  meetupId: string;
  requestId: string;
  payloadHash: string;
  requestedById: string;
  requestedK: number;
  status: RecommendationRunStatus;
  failureCode: string | null;
  rankingStrategy: 'fair-pareto-v1';
  algorithmVersion: string;
  configVersion: string;
  featureSchemaVersion: string;
  providerMappingVersion: string;
  providerRequestOptionsVersion: string;
  openingFilter: 'ANY' | 'OPEN_AT_REQUEST_TIME' | 'OPEN_AT_SCHEDULED_TIME';
  openingEvaluatorVersion: string;
  requestedAt: Date;
  scheduledAtSnapshot: Date;
  createdAt: Date;
  completedAt: Date | null;
  effectiveK: number | null;
  warnings: string[];
  randomSeed: string | null;
  routeBatchCount: number | null;
  routeElementCount: number | null;
}

export type RecommendationCandidateFilterStatus = 'ELIGIBLE' | 'FILTERED';

export interface RecommendationCandidateSnapshot {
  id: string;
  runId: string;
  canonicalCandidateKey: string;
  provider: string;
  providerPlaceId: string;
  name: string;
  latitude: number;
  longitude: number;
  providerTypes: string[];
  sourceCategories: string[];
  sourcePages: number[];
  filterStatus: RecommendationCandidateFilterStatus;
  filterReason: string | null;
  createdAt: Date;
  normalizedTags: string[];
  rating0To5: number | null;
  userRatingCount: number | null;
  finalRank: number | null;
  groupUtility: number | null;
  candidateLeastMiseryUtility: number | null;
  paretoLevel: number | null;
  inclusionProbability: number | null;
  avgEtaSeconds: number | null;
  maxEtaSeconds: number | null;
  etaRangeSeconds: number | null;
  scheduledOpeningStatus: ScheduledOpeningStatus | null;
  openingEvidence: ScheduledOpeningEvidence | null;
}

export interface RecommendationMemberFeatureSnapshot {
  id: string;
  runId: string;
  candidateId: string;
  participantId: string;
  canonicalCandidateKey: string;
  etaSeconds: number;
  distanceMeters: number;
  matchedTags: Array<{
    tagCode: string;
    level: 'high' | 'normal' | 'avoid';
    weight: number;
  }>;
  missingFlags: string[];
  travelUtility: number;
  preferenceUtility: number;
  placeQualityUtility: number;
  memberUtility: number;
  routeStatus: 'OK';
  createdAt: Date;
}

export interface RecommendationCompletion {
  candidates: RecommendationCandidateSnapshot[];
  memberFeatures: RecommendationMemberFeatureSnapshot[];
  effectiveK: number;
  warnings: string[];
  randomSeed: string;
  routeBatchCount: number;
  routeElementCount: number;
}

export interface RecommendationRunResult extends RecommendationRun {
  candidates: RecommendationCandidateSnapshot[];
  memberFeatures: RecommendationMemberFeatureSnapshot[];
}

export interface RecommendationRunView extends RecommendationRunResult {
  contextStatus: RecommendationContextStatus;
}
