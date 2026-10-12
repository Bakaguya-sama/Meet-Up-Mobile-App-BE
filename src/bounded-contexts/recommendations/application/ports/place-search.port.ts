export const PLACE_SEARCH = Symbol('PLACE_SEARCH');

export interface PlaceCandidate {
  providerPlaceId: string;
  name: string;
  categories: string[];
  rating?: number;
  openingHours?: { openNow?: boolean };
  photoUrl?: string;
}

export interface PlaceSearchPort {
  search(input: {
    query: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  }): Promise<PlaceCandidate[]>;
}
