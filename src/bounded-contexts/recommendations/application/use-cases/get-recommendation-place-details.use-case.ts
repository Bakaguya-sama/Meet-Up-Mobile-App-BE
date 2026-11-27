import type { PlaceSearchPort } from '../ports/place-search.port';
import { GetRecommendationRunUseCase } from './get-recommendation-run.use-case';

export class GetRecommendationPlaceDetailsUseCase {
  constructor(
    private readonly getRun: GetRecommendationRunUseCase,
    private readonly places: PlaceSearchPort,
  ) {}

  async execute(actorId: string, meetupId: string, runId: string) {
    const run = await this.getRun.execute(actorId, meetupId, runId);
    const items = await Promise.all(
      run.results.map(async ({ rank, canonicalCandidateKey, candidate }) => ({
        rank,
        canonicalCandidateKey,
        details:
          candidate.provider === 'google-places'
            ? await this.places.getDetails(candidate.providerPlaceId)
            : null,
      })),
    );
    return { runId: run.id, items };
  }
}
