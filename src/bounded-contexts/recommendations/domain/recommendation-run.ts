export type RecommendationRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

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
  createdAt: Date;
  completedAt: Date | null;
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
}

export interface RecommendationRunResult extends RecommendationRun {
  candidates: RecommendationCandidateSnapshot[];
}
