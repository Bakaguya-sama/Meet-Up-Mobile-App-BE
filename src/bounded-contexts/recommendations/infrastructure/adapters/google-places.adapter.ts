import { Injectable } from '@nestjs/common';
import type {
  PlaceCandidate,
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
  'places.currentOpeningHours.openNow',
].join(',');

export type PlacesFetch = (
  url: string,
  init: RequestInit,
) => Promise<Pick<Response, 'ok' | 'json'>>;

interface GooglePlace {
  id?: unknown;
  displayName?: { text?: unknown };
  types?: unknown;
  location?: { latitude?: unknown; longitude?: unknown };
  formattedAddress?: unknown;
  rating?: unknown;
  currentOpeningHours?: { openNow?: unknown };
}

interface GoogleTextSearchResponse {
  places?: GooglePlace[];
}

@Injectable()
export class GooglePlacesAdapter implements PlaceSearchPort {
  constructor(
    private readonly apiKey: string,
    private readonly request: PlacesFetch = fetch,
  ) {}

  async search(input: {
    query: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  }): Promise<PlaceCandidate[]> {
    if (!this.apiKey) {
      throw new RecommendationError(
        'PLACE_SEARCH_UNAVAILABLE',
        'Google Places API is not configured',
      );
    }
    try {
      const response = await this.request(TEXT_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: input.query,
          includedType: input.query,
          strictTypeFiltering: true,
          pageSize: 20,
          locationBias: {
            circle: {
              center: { latitude: input.latitude, longitude: input.longitude },
              radius: input.radiusMeters,
            },
          },
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        throw new RecommendationError(
          'PLACE_SEARCH_UNAVAILABLE',
          'Google Places could not search for candidate places',
        );
      }
      const payload = (await response.json()) as GoogleTextSearchResponse;
      return (payload.places ?? [])
        .map((place) => toCandidate(place))
        .filter((candidate): candidate is PlaceCandidate => candidate !== null);
    } catch (error) {
      if (error instanceof RecommendationError) throw error;
      throw new RecommendationError(
        'PLACE_SEARCH_UNAVAILABLE',
        'Google Places could not search for candidate places',
      );
    }
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
    ...(typeof place.currentOpeningHours?.openNow === 'boolean'
      ? { openingHours: { openNow: place.currentOpeningHours.openNow } }
      : {}),
  };
}
