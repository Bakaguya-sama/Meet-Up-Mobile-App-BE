import { RecommendationError } from '../../domain/recommendation.error';
import type { FavoritePlaceStore } from '../ports/favorite-place-store.port';

export class ManageFavoritePlaceUseCase {
  constructor(private readonly store: FavoritePlaceStore) {}

  async add(userId: string, placeId: string) {
    const id = placeId.trim();
    if (!id || id.length > 255) {
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

  list(userId: string) {
    return this.store.list(userId);
  }

  async remove(userId: string, placeId: string) {
    const id = placeId.trim();
    if (!id || id.length > 255) {
      throw new RecommendationError(
        'INVALID_RECOMMENDATION_REQUEST',
        'Invalid Place ID',
      );
    }
    await this.store.remove(userId, id);
  }
}
