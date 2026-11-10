import { RecommendationError } from '../../domain/recommendation.error';
import type { FavoritePlaceStore } from '../ports/favorite-place-store.port';

export class RemoveFavoritePlaceUseCase {
  constructor(private readonly store: FavoritePlaceStore) {}

  async execute(userId: string, placeId: string): Promise<void> {
    const id = placeId.trim();
    if (!id || id.length > 300) {
      throw new RecommendationError(
        'INVALID_RECOMMENDATION_REQUEST',
        'Invalid Place ID',
      );
    }
    await this.store.remove(userId, id);
  }
}
