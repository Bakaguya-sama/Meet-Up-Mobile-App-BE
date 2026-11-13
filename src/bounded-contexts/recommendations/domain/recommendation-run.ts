import type {
  RecommendationContextStatus,
  ScheduledOpeningEvidence,
  ScheduledOpeningStatus,
  ClosingEvidence,
} from './temporal-context';

export interface WeatherEvidence {
  availability: 'AVAILABLE' | 'UNAVAILABLE' | 'OUT_OF_RANGE';
  severity?: number;
  provider: string;
  observedAt?: string;
}

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
  routingPreferenceRequested: 'TRAFFIC_UNAWARE' | 'TRAFFIC_AWARE';
  routingPreferenceEffective: 'TRAFFIC_UNAWARE' | 'TRAFFIC_AWARE';
  weatherPolicyRequested: 'OFF' | 'WARN_ONLY' | 'FILTER_OUTDOOR';
  weatherPolicyEffective: 'OFF' | 'WARN_ONLY' | 'FILTER_OUTDOOR';
  weatherPolicyVersion: string;
  closingPolicyVersion: string;
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
  weatherEvidence: WeatherEvidence | null;
  closingEvidence: ClosingEvidence | null;
}

export type RecommendationExplanationUnit =
  'SECOND' | 'METER' | 'UTILITY_0_1' | 'PROBABILITY_0_1' | 'COUNT';

export type RecommendationExplanationSource =
  'ROUTES' | 'PLACES' | 'WEATHER' | 'ENGINE';

export interface RecommendationExplanationFact {
  key: string;
  value: string | number;
  unit?: RecommendationExplanationUnit;
  source: RecommendationExplanationSource;
}

export interface RecommendationExplanation {
  summaryCode:
    'MIN_SUM_RANKED' | 'MIN_MAX_RANKED' | 'FAIR_PARETO_RANKED' | 'LTR_RANKED';
  facts: RecommendationExplanationFact[];
  warnings: string[];
}

export interface RecommendationPlaceSnapshot {
  id: string;
  runId: string;
  candidateId: string;
  canonicalCandidateKey: string;
  rank: number;
  groupUtility: number;
  candidateLeastMiseryUtility: number;
  paretoLevel: number;
  inclusionProbability: number | null;
  avgEtaSeconds: number;
  maxEtaSeconds: number;
  etaRangeSeconds: number;
  scheduledOpeningStatus: ScheduledOpeningStatus | null;
  openingEvidence: ScheduledOpeningEvidence | null;
  weatherEvidence: WeatherEvidence | null;
  closingEvidence: ClosingEvidence | null;
  explanation: RecommendationExplanation;
  createdAt: Date;
}

export interface RecommendationMemberFeatureSnapshot {
  id: string;
  runId: string;
  candidateId: string;
  participantId: string;
  canonicalCandidateKey: string;
  etaSeconds: number;
  distanceMeters: number;
  staticDurationSeconds: number | null;
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
  rankingUtility: number;
  routeStatus: 'OK';
  createdAt: Date;
}

export interface RecommendationCompletion {
  candidates: RecommendationCandidateSnapshot[];
  memberFeatures: RecommendationMemberFeatureSnapshot[];
  places: RecommendationPlaceSnapshot[];
  effectiveK: number;
  warnings: string[];
  randomSeed: string;
  routeBatchCount: number;
  routeElementCount: number;
  readyEventId: string;
  routingPreferenceEffective: 'TRAFFIC_UNAWARE' | 'TRAFFIC_AWARE';
  weatherPolicyEffective: 'OFF' | 'WARN_ONLY' | 'FILTER_OUTDOOR';
}

export interface RecommendationRunResult extends RecommendationRun {
  candidates: RecommendationCandidateSnapshot[];
  memberFeatures: RecommendationMemberFeatureSnapshot[];
  places: RecommendationPlaceSnapshot[];
}

export interface RecommendationRunView extends RecommendationRunResult {
  contextStatus: RecommendationContextStatus;
}

export interface RecommendationPublicResult {
  rank: number;
  canonicalCandidateKey: string;
  candidate: Pick<
    RecommendationCandidateSnapshot,
    | 'canonicalCandidateKey'
    | 'provider'
    | 'providerPlaceId'
    | 'name'
    | 'rating0To5'
    | 'userRatingCount'
  >;
  avgEtaSeconds: number;
  maxEtaSeconds: number;
  etaRangeSeconds: number;
  memberEtas: Array<{ participantId: string; etaSeconds: number }>;
  viewerFeature: null | Pick<
    RecommendationMemberFeatureSnapshot,
    | 'participantId'
    | 'matchedTags'
    | 'travelUtility'
    | 'preferenceUtility'
    | 'placeQualityUtility'
    | 'memberUtility'
  >;
  scheduledOpeningStatus: ScheduledOpeningStatus | null;
  closingEvidence: ClosingEvidence | null;
  explanation: RecommendationExplanation;
}

export interface RecommendationPublicView extends Omit<
  RecommendationRunResult,
  'candidates' | 'memberFeatures' | 'places'
> {
  contextStatus: RecommendationContextStatus;
  results: RecommendationPublicResult[];
}
