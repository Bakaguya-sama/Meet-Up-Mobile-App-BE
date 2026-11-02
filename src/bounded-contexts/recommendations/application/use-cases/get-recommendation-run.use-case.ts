import type { RecommendationRunStore } from '../ports/recommendation-run-store.port';
import { RecommendationError } from '../../domain/recommendation.error';
import { RecommendationRunFreshnessGuard } from '../public/recommendation-run-freshness.guard';
import { presentRecommendationResult } from '../services/recommendation-result.presenter';

export class GetRecommendationRunUseCase {
  constructor(
    private readonly store: RecommendationRunStore,
    private readonly freshness: RecommendationRunFreshnessGuard,
  ) {}

  async execute(actorId: string, meetupId: string, runId: string) {
    const run = await this.store.findById(
      meetupId.toLowerCase(),
      runId.toLowerCase(),
    );
    if (!run) {
      throw new RecommendationError(
        'RECOMMENDATION_RUN_NOT_FOUND',
        'Recommendation run not found',
      );
    }
    if (run.requestedById !== actorId.toLowerCase()) {
      throw new RecommendationError(
        'RECOMMENDATION_RUN_FORBIDDEN',
        'Recommendation run is unavailable to this actor',
      );
    }
    return presentRecommendationResult(run, await this.freshness.status(run));
  }
}
