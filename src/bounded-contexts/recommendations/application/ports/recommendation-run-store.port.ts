import type {
  RecommendationCompletion,
  RecommendationRun,
  RecommendationRunResult,
} from '../../domain/recommendation-run';

export const RECOMMENDATION_RUN_STORE = Symbol('RECOMMENDATION_RUN_STORE');
export interface RecommendationRunStore {
  findByRequest(
    meetupId: string,
    requestId: string,
  ): Promise<RecommendationRunResult | null>;
  findById(
    meetupId: string,
    runId: string,
  ): Promise<RecommendationRunResult | null>;
  create(run: RecommendationRun): Promise<RecommendationRunResult>;
  complete(
    runId: string,
    completion: RecommendationCompletion,
    completedAt: Date,
  ): Promise<RecommendationRunResult>;
  fail(runId: string, failureCode: string, completedAt: Date): Promise<void>;
}
