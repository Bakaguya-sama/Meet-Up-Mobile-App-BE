export const PLACE_SEARCH = Symbol('PLACE_SEARCH');

export interface PlaceCandidate {
  provider?: string;
  providerPlaceId: string;
  name: string;
  categories: string[];
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  openingHours?: { openNow?: boolean };
  businessStatus?:
    'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' | 'UNKNOWN';
}

export interface PlaceSearchInput {
  query: string;
  includedType?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  openNow?: boolean;
  pageToken?: string;
}

export interface PlaceSearchPage {
  candidates: PlaceCandidate[];
  nextPageToken?: string;
}

export interface PlaceSearchPort {
  search(input: PlaceSearchInput): Promise<PlaceCandidate[]>;
  searchPage(input: PlaceSearchInput): Promise<PlaceSearchPage>;
}
