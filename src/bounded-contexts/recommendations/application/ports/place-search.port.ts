import type { NormalizedOpeningHours } from '../../domain/opening-hours';
export type {
  NormalizedOpeningHours,
  NormalizedOpeningPeriod,
  NormalizedOpeningPoint,
} from '../../domain/opening-hours';

export const PLACE_SEARCH = Symbol('PLACE_SEARCH');
export const PLACE_SEARCH_REQUEST_OPTIONS_VERSION =
  'google-places-text-search-v2-scheduled-opening';

export type OpeningFilter =
  'ANY' | 'OPEN_AT_REQUEST_TIME' | 'OPEN_AT_SCHEDULED_TIME';

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
  currentOpeningHours?: NormalizedOpeningHours;
  regularOpeningHours?: NormalizedOpeningHours;
  timeZoneId?: string;
  utcOffsetMinutes?: number;
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
  includeScheduledOpeningFields?: boolean;
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
