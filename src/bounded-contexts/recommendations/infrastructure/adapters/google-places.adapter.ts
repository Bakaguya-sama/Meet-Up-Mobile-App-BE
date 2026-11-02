import { Injectable } from '@nestjs/common';
import type {
  NormalizedOpeningHours,
  NormalizedOpeningPeriod,
  PlaceCandidate,
  PlaceSearchInput,
  PlaceSearchPage,
  PlaceSearchPort,
} from '../../application/ports/place-search.port';
import { PLACE_SEARCH_REQUEST_OPTIONS_VERSION } from '../../application/ports/place-search.port';
import { RecommendationError } from '../../domain/recommendation.error';

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const BASE_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.types',
  'places.location',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'nextPageToken',
];
const SCHEDULED_OPENING_FIELD_MASK = [
  'places.currentOpeningHours',
  'places.regularOpeningHours',
  'places.utcOffsetMinutes',
];

export const GOOGLE_PLACES_REQUEST_OPTIONS_VERSION =
  PLACE_SEARCH_REQUEST_OPTIONS_VERSION;

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
  currentOpeningHours?: GoogleOpeningHours;
  regularOpeningHours?: GoogleOpeningHours;
  utcOffsetMinutes?: unknown;
  timeZone?: unknown;
  businessStatus?: unknown;
}

interface GoogleOpeningPoint {
  day?: unknown;
  hour?: unknown;
  minute?: unknown;
  date?: { year?: unknown; month?: unknown; day?: unknown };
}

interface GoogleOpeningHours {
  openNow?: unknown;
  periods?: Array<{ open?: GoogleOpeningPoint; close?: GoogleOpeningPoint }>;
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
    private readonly now: () => Date = () => new Date(),
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
            'X-Goog-FieldMask': [
              ...BASE_FIELD_MASK,
              ...(input.openNow === true
                ? ['places.currentOpeningHours.openNow']
                : []),
              ...(input.includeScheduledOpeningFields
                ? SCHEDULED_OPENING_FIELD_MASK
                : []),
            ].join(','),
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
        const retrievedAt = this.now();
        return {
          candidates: (payload.places ?? [])
            .map((place) =>
              toCandidate(
                place,
                input.includeScheduledOpeningFields === true,
                retrievedAt,
              ),
            )
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

function toCandidate(
  place: GooglePlace,
  includeScheduledOpeningFields: boolean,
  retrievedAt: Date,
): PlaceCandidate | null {
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
    ...(includeScheduledOpeningFields
      ? scheduledOpeningFields(place, retrievedAt)
      : {}),
    ...(isBusinessStatus(place.businessStatus)
      ? { businessStatus: place.businessStatus }
      : {}),
  };
}

function scheduledOpeningFields(place: GooglePlace, retrievedAt: Date) {
  const utcOffsetMinutes =
    typeof place.utcOffsetMinutes === 'number' &&
    Number.isInteger(place.utcOffsetMinutes) &&
    place.utcOffsetMinutes >= -14 * 60 &&
    place.utcOffsetMinutes <= 14 * 60
      ? place.utcOffsetMinutes
      : undefined;
  const currentOpeningHours = normalizeOpeningHours(
    place.currentOpeningHours,
    'CURRENT',
    currentHoursCoverage(retrievedAt, utcOffsetMinutes),
  );
  const regularOpeningHours = normalizeOpeningHours(
    place.regularOpeningHours,
    'REGULAR',
  );
  const timeZoneId =
    typeof place.timeZone === 'object' &&
    place.timeZone !== null &&
    'id' in place.timeZone &&
    typeof place.timeZone.id === 'string'
      ? place.timeZone.id
      : undefined;
  return {
    ...(currentOpeningHours ? { currentOpeningHours } : {}),
    ...(regularOpeningHours ? { regularOpeningHours } : {}),
    ...(timeZoneId ? { timeZoneId } : {}),
    ...(utcOffsetMinutes !== undefined ? { utcOffsetMinutes } : {}),
  };
}

function normalizeOpeningHours(
  input: GoogleOpeningHours | undefined,
  source: 'CURRENT' | 'REGULAR',
  explicitCoverage?: { start: string; end: string },
): NormalizedOpeningHours | undefined {
  if (!input || !Array.isArray(input.periods)) return undefined;
  const periods = input.periods
    .map((period) => normalizePeriod(period))
    .filter((period): period is NormalizedOpeningPeriod => period !== null);
  if (periods.length !== input.periods.length) return undefined;
  const dates = periods
    .flatMap((period) => [period.open.date, period.close?.date])
    .filter((date): date is string => typeof date === 'string')
    .sort();
  return {
    source,
    periods,
    ...(source === 'CURRENT' && (explicitCoverage || dates.length)
      ? {
          coverageStartDate: explicitCoverage?.start ?? dates[0],
          coverageEndDate: explicitCoverage?.end ?? dates[dates.length - 1],
        }
      : {}),
  };
}

function currentHoursCoverage(
  retrievedAt: Date,
  utcOffsetMinutes?: number,
): { start: string; end: string } | undefined {
  if (
    !Number.isFinite(retrievedAt.getTime()) ||
    !Number.isInteger(utcOffsetMinutes)
  ) {
    return undefined;
  }
  const local = new Date(retrievedAt.getTime() + utcOffsetMinutes! * 60_000);
  const startDate = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
  return {
    start: formatUtcDate(new Date(startDate)),
    end: formatUtcDate(new Date(startDate + 6 * 24 * 60 * 60 * 1000)),
  };
}

function formatUtcDate(value: Date) {
  return `${value.getUTCFullYear().toString().padStart(4, '0')}-${(
    value.getUTCMonth() + 1
  )
    .toString()
    .padStart(2, '0')}-${value.getUTCDate().toString().padStart(2, '0')}`;
}

function normalizePeriod(input: {
  open?: GoogleOpeningPoint;
  close?: GoogleOpeningPoint;
}): NormalizedOpeningPeriod | null {
  const open = normalizePoint(input.open);
  if (!open) return null;
  const close = input.close ? normalizePoint(input.close) : undefined;
  if (input.close && !close) return null;
  return { open, ...(close ? { close } : {}) };
}

function normalizePoint(input?: GoogleOpeningPoint) {
  if (
    !input ||
    !Number.isInteger(input.day) ||
    (input.day as number) < 0 ||
    (input.day as number) > 6 ||
    !Number.isInteger(input.hour) ||
    (input.hour as number) < 0 ||
    (input.hour as number) > 23 ||
    !Number.isInteger(input.minute) ||
    (input.minute as number) < 0 ||
    (input.minute as number) > 59
  ) {
    return null;
  }
  const date = normalizeDate(input.date);
  if (input.date && !date) return null;
  return {
    day: input.day as number,
    hour: input.hour as number,
    minute: input.minute as number,
    ...(date ? { date } : {}),
  };
}

function normalizeDate(input?: GoogleOpeningPoint['date']) {
  if (
    !input ||
    !Number.isInteger(input.year) ||
    !Number.isInteger(input.month) ||
    !Number.isInteger(input.day)
  ) {
    return undefined;
  }
  const year = input.year as number;
  const month = input.month as number;
  const day = input.day as number;
  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() + 1 !== month ||
    value.getUTCDate() !== day
  ) {
    return undefined;
  }
  return `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function isBusinessStatus(
  value: unknown,
): value is PlaceCandidate['businessStatus'] {
  return (
    typeof value === 'string' &&
    ['OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'].includes(value)
  );
}
