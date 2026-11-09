import { RecommendationError } from '../../domain/recommendation.error';
import type { FavoritePlaceStore } from '../ports/favorite-place-store.port';

export class AddFavoritePlaceUseCase {
  constructor(private readonly store: FavoritePlaceStore) {}

  async execute(userId: string, placeId: string) {
    const id = placeId.trim();
    if (!id || id.length > 300) {
      throw new RecommendationError(
        'INVALID_RECOMMENDATION_REQUEST',
        'Invalid Place ID',
      );
    }
    const favorite = await this.store.add(userId, id);
    if (!favorite) {
      throw new RecommendationError(
        'RECOMMENDATION_CANDIDATE_NOT_FOUND',
        'Place ID is not a known recommendation candidate',
      );
    }
    return favorite;
  }
}
