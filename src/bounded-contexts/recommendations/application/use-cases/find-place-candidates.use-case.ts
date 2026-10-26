import { RecommendationError } from '../../domain/recommendation.error';
import type { MeetupCandidateSearchPort } from '../ports/meetup-candidate-search.port';
import type { MeetupLocationPort } from '../ports/meetup-location.port';
import type { PlaceSearchPort } from '../ports/place-search.port';

export class FindPlaceCandidatesUseCase {
  constructor(
    private readonly meetups: MeetupCandidateSearchPort,
    private readonly locations: MeetupLocationPort,
    private readonly places: PlaceSearchPort,
  ) {}

  async execute(actorId: string, meetupId: string) {
    const context = await this.meetups.getCandidateSearchContext(
      actorId.toLowerCase(),
      meetupId.toLowerCase(),
    );
    const locations = await this.locations.getActiveLocations(
      context.meetupId,
      actorId.toLowerCase(),
      context.acceptedMemberUserIds,
    );
    if (locations.length < 2) {
      throw new RecommendationError(
        'RECOMMENDATION_INSUFFICIENT_LOCATIONS',
        'At least two accepted members need a current shared location',
      );
    }

    const searchedAround = {
      latitude: mean(locations.map((location) => location.latitude)),
      longitude: mean(locations.map((location) => location.longitude)),
    };
    const candidates = await this.places.search({
      query: context.placeType,
      ...searchedAround,
      radiusMeters: context.searchRadiusMeters,
    });

    return {
      meetupId: context.meetupId,
      placeType: context.placeType,
      searchedAround,
      candidates,
    };
  }
}

function mean(values: number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 1_000_000) / 1_000_000;
}
