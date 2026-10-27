import type { PlaceSearchPort } from '../ports/place-search.port';
import type {
  PlaceCategoryMapping,
  RecommendationConfig,
} from '../recommendation-config';
import type { RawCandidate } from './candidate-filter';

interface RetrievalState {
  mapping: PlaceCategoryMapping;
  nextPageToken?: string;
  page: number;
  exhausted: boolean;
}

export class CandidateGenerator {
  constructor(
    private readonly places: PlaceSearchPort,
    private readonly config: RecommendationConfig,
  ) {}

  async generate(input: {
    categories: string[];
    openingFilter: 'ANY' | 'OPEN_AT_REQUEST_TIME';
    center: { latitude: number; longitude: number };
    radiusMeters: number;
  }): Promise<RawCandidate[]> {
    const mappings = new Map(
      this.config.categoryMappings.map((mapping) => [
        mapping.internalCategory,
        mapping,
      ]),
    );
    const states: RetrievalState[] = [...input.categories]
      .sort()
      .map((category) => ({
        mapping: mappings.get(category)!,
        page: 0,
        exhausted: false,
      }));
    const candidates: RawCandidate[] = [];
    let calls = 0;
    while (
      calls < this.config.providerCallBudget &&
      candidates.length < this.config.candidateTargetCount &&
      states.some((state) => !state.exhausted)
    ) {
      for (const state of states) {
        if (
          state.exhausted ||
          calls >= this.config.providerCallBudget ||
          candidates.length >= this.config.candidateTargetCount
        ) {
          continue;
        }
        const page = await this.places.searchPage({
          query: state.mapping.textQuery,
          includedType: state.mapping.includedType,
          latitude: input.center.latitude,
          longitude: input.center.longitude,
          radiusMeters: input.radiusMeters,
          ...(input.openingFilter === 'OPEN_AT_REQUEST_TIME'
            ? { openNow: true }
            : {}),
          ...(state.nextPageToken ? { pageToken: state.nextPageToken } : {}),
        });
        calls += 1;
        state.page += 1;
        state.nextPageToken = page.nextPageToken;
        state.exhausted = !page.nextPageToken;
        for (const candidate of page.candidates) {
          if (candidates.length >= this.config.candidateMaxCount) break;
          candidates.push({
            provider: candidate.provider ?? 'google-places',
            providerPlaceId: candidate.providerPlaceId,
            name: candidate.name,
            latitude: candidate.latitude,
            longitude: candidate.longitude,
            providerTypes: [...candidate.categories],
            sourceCategory: state.mapping.internalCategory,
            sourcePage: state.page,
            businessStatus: candidate.businessStatus,
            rating0To5: candidate.rating,
            currentOpen: candidate.openingHours?.openNow,
          });
        }
      }
    }
    return candidates.slice(0, this.config.candidateMaxCount);
  }
}
