export interface FavoritePlace {
  id: string;
  provider: string;
  providerPlaceId: string;
  canonicalCandidateKey: string;
  placeName: string;
  createdAt: Date;
}

export const FAVORITE_PLACE_STORE = Symbol('FAVORITE_PLACE_STORE');
export interface FavoritePlaceStore {
  add(userId: string, placeId: string): Promise<FavoritePlace | null>;
  list(userId: string): Promise<FavoritePlace[]>;
  remove(userId: string, placeId: string): Promise<void>;
}
