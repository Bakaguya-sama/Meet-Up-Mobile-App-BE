export const OFFLINE_DATASET_SCHEMA_VERSION = 'recommendation-offline-v1';
export const OFFLINE_LABEL_VERSION = 'feedback-label-v1';
export const OFFLINE_REDACTION_VERSION = 'pseudonymous-no-coordinates-v1';

export type OfflineLabel = 0 | 1 | 2 | 3 | null;

/** A row is emitted only for an actual impression; null means a candidate was not exposed. */
export interface OfflineDatasetRow {
  runId: string;
  canonicalCandidateKey: string;
  participantPseudonym: string;
  recommendationTimestamp: string;
  algorithmVersion: string;
  configVersion: string;
  featureSchemaVersion: string;
  rankingStrategy: string;
  groupSize: number;
  category: string | null;
  impressionRank: number;
  originalRank: number | null;
  label: OfflineLabel;
  shown: true;
  rawEvents: Record<string, number>;
  features: {
    etaSeconds: number;
    distanceMeters: number;
    staticDurationSeconds: number | null;
    travelUtility: number;
    preferenceUtility: number;
    placeQualityUtility: number;
    memberUtility: number;
    rankingUtility: number;
    groupUtility: number | null;
    leastMiseryUtility: number | null;
    avgEtaSeconds: number | null;
    maxEtaSeconds: number | null;
    etaRangeSeconds: number | null;
    candidateRating: number | null;
    candidateRatingCount: number | null;
    scheduledOpeningStatus: string | null;
    missingFlags: string[];
  };
}

export interface OfflineDatasetManifest {
  datasetSchemaVersion: typeof OFFLINE_DATASET_SCHEMA_VERSION;
  labelVersion: typeof OFFLINE_LABEL_VERSION;
  redactionPolicyVersion: typeof OFFLINE_REDACTION_VERSION;
  featureSchemaVersions: string[];
  sourceTimeWindow: { from: string; to: string };
  generatedAt: string;
  rowCount: number;
  sourceRunCount: number;
  algorithmVersions: string[];
  configVersions: string[];
  modelVersions: string[];
  contentSha256: string;
  generatorCommitSha: string | null;
}

export interface EvaluationTimeSplit {
  train: { from: Date; to: Date };
  validation: { from: Date; to: Date };
  test: { from: Date; to: Date };
}

export interface OfflineEvaluationSource {
  readCompletedRuns(input: {
    from: Date;
    to: Date;
    algorithmVersion?: string;
    configVersion?: string;
  }): Promise<OfflineSourceRun[]>;
}

export interface OfflineSourceRun {
  id: string;
  requestedAt: Date;
  algorithmVersion: string;
  configVersion: string;
  featureSchemaVersion: string;
  rankingStrategy: string;
  randomSeed: string | null;
  effectiveK: number | null;
  routeElementCount: number | null;
  memberFeatures: OfflineSourceFeature[];
  candidates: OfflineSourceCandidate[];
  impressions: OfflineSourceImpression[];
  feedback: OfflineSourceFeedback[];
}

export interface OfflineSourceFeature {
  participantId: string;
  canonicalCandidateKey: string;
  etaSeconds: number;
  distanceMeters: number;
  staticDurationSeconds: number | null;
  travelUtility: number;
  preferenceUtility: number;
  placeQualityUtility: number;
  memberUtility: number;
  rankingUtility: number;
  missingFlags: string[];
}

export interface OfflineSourceCandidate {
  canonicalCandidateKey: string;
  sourceCategories: string[];
  rating0To5: number | null;
  userRatingCount: number | null;
  finalRank: number | null;
  groupUtility: number | null;
  candidateLeastMiseryUtility: number | null;
  avgEtaSeconds: number | null;
  maxEtaSeconds: number | null;
  etaRangeSeconds: number | null;
  scheduledOpeningStatus: string | null;
}

export interface OfflineSourceImpression {
  eventId: string;
  participantId: string;
  canonicalCandidateKey: string;
  rank: number;
}

export interface OfflineSourceFeedback {
  eventId: string;
  participantId: string | null;
  canonicalCandidateKey: string | null;
  eventType: 'PLACE_VOTED' | 'VOTE_CHANGED' | 'MEETUP_PLACE_SELECTED' | 'NAVIGATION_OPENED' | 'FAVORITE_ADDED' | 'MEETUP_COMPLETED';
}
