import type { FavoritePlaceStore } from '../ports/favorite-place-store.port';

export class ListFavoritePlacesUseCase {
  constructor(private readonly store: FavoritePlaceStore) {}

  execute(userId: string) {
    return this.store.list(userId);
  }
}
