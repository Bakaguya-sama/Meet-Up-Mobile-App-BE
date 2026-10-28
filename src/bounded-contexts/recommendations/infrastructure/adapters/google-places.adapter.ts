import { Injectable } from '@nestjs/common';
import type {
  PlaceCandidate,
  PlaceSearchInput,
  PlaceSearchPage,
  PlaceSearchPort,
} from '../../application/ports/place-search.port';
import { RecommendationError } from '../../domain/recommendation.error';

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.types',
  'places.location',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.currentOpeningHours.openNow',
  'places.businessStatus',
  'nextPageToken',
].join(',');

export type PlacesFetch = (
  url: string,
  init: RequestInit,
) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

interface GooglePlace {
  id?: unknown;
  displayName?: { text?: unknown };
  types?: unknown;
  location?: { latitude?: unknown; longitude?: unknown };
  formattedAddress?: unknown;
  rating?: unknown;
  userRatingCount?: unknown;
  currentOpeningHours?: { openNow?: unknown };
  businessStatus?: unknown;
}

interface GoogleTextSearchResponse {
  places?: GooglePlace[];
  nextPageToken?: unknown;
}

@Injectable()
export class GooglePlacesAdapter implements PlaceSearchPort {
  constructor(
    private readonly apiKey: string,
    private readonly request: PlacesFetch = fetch,
    private readonly maxAttempts = 2,
    private readonly timeoutMs = 8_000,
    private readonly endpoint = TEXT_SEARCH_URL,
  ) {}

  async search(input: PlaceSearchInput): Promise<PlaceCandidate[]> {
    return (await this.searchPage(input)).candidates;
  }

  async searchPage(input: PlaceSearchInput): Promise<PlaceSearchPage> {
    if (!this.apiKey) {
      throw new RecommendationError(
        'PLACE_SEARCH_UNAVAILABLE',
        'Google Places API is not configured',
      );
    }
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await this.request(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask': FIELD_MASK,
          },
          body: JSON.stringify({
            textQuery: input.query,
            includedType: input.includedType ?? input.query,
            strictTypeFiltering: true,
            pageSize: 20,
            ...(input.pageToken ? { pageToken: input.pageToken } : {}),
            ...(input.openNow === true ? { openNow: true } : {}),
            locationBias: {
              circle: {
                center: {
                  latitude: input.latitude,
                  longitude: input.longitude,
                },
                radius: input.radiusMeters,
              },
            },
          }),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!response.ok) {
          if (response.status < 500 && response.status !== 429) break;
          throw new Error(`Google Places HTTP ${response.status}`);
        }
        const payload = (await response.json()) as GoogleTextSearchResponse;
        return {
          candidates: (payload.places ?? [])
            .map((place) => toCandidate(place))
            .filter(
              (candidate): candidate is PlaceCandidate => candidate !== null,
            ),
          ...(typeof payload.nextPageToken === 'string' &&
          payload.nextPageToken.length > 0
            ? { nextPageToken: payload.nextPageToken }
            : {}),
        };
      } catch (error) {
        lastError = error;
      }
    }
    void lastError;
    throw new RecommendationError(
      'PLACE_SEARCH_UNAVAILABLE',
      'Google Places could not search for candidate places',
    );
  }
}

function toCandidate(place: GooglePlace): PlaceCandidate | null {
  if (
    typeof place.id !== 'string' ||
    typeof place.displayName?.text !== 'string' ||
    typeof place.location?.latitude !== 'number' ||
    typeof place.location?.longitude !== 'number' ||
    !Number.isFinite(place.location.latitude) ||
    !Number.isFinite(place.location.longitude)
  ) {
    return null;
  }
  return {
    provider: 'google-places',
    providerPlaceId: place.id,
    name: place.displayName.text,
    categories: Array.isArray(place.types)
      ? place.types.filter((type): type is string => typeof type === 'string')
      : [],
    latitude: place.location.latitude,
    longitude: place.location.longitude,
    ...(typeof place.formattedAddress === 'string'
      ? { formattedAddress: place.formattedAddress }
      : {}),
    ...(typeof place.rating === 'number' && Number.isFinite(place.rating)
      ? { rating: place.rating }
      : {}),
    ...(typeof place.userRatingCount === 'number' &&
    Number.isInteger(place.userRatingCount) &&
    place.userRatingCount >= 0
      ? { userRatingCount: place.userRatingCount }
      : {}),
    ...(typeof place.currentOpeningHours?.openNow === 'boolean'
      ? { openingHours: { openNow: place.currentOpeningHours.openNow } }
      : {}),
    ...(isBusinessStatus(place.businessStatus)
      ? { businessStatus: place.businessStatus }
      : {}),
  };
}

function isBusinessStatus(
  value: unknown,
): value is PlaceCandidate['businessStatus'] {
  return (
    typeof value === 'string' &&
    ['OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'].includes(value)
  );
}
