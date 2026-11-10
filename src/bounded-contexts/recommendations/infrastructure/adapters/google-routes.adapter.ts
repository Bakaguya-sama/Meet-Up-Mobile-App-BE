import { Injectable } from '@nestjs/common';
import type {
  RouteBatchRequest,
  RouteBatchResult,
  RouteMatrixPort,
} from '../../application/ports/route-matrix.port';
import { RecommendationError } from '../../domain/recommendation.error';

const ROUTE_MATRIX_URL =
  'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
const FIELD_MASK = [
  'originIndex',
  'destinationIndex',
  'status',
  'condition',
  'distanceMeters',
  'duration',
  'staticDuration',
  'fallbackInfo',
].join(',');

export type RoutesFetch = (
  url: string,
  init: RequestInit,
) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

interface GoogleRouteElement {
  originIndex?: unknown;
  destinationIndex?: unknown;
  status?: { code?: unknown; message?: unknown };
  condition?: unknown;
  distanceMeters?: unknown;
  duration?: unknown;
  staticDuration?: unknown;
}

@Injectable()
export class GoogleRoutesAdapter implements RouteMatrixPort {
  constructor(
    private readonly apiKey: string,
    private readonly request: RoutesFetch = fetch,
    private readonly maxAttempts = 2,
    private readonly timeoutMs = 8_000,
    private readonly endpoint = ROUTE_MATRIX_URL,
  ) {}

  async calculateBatch(input: RouteBatchRequest): Promise<RouteBatchResult> {
    if (!this.apiKey) {
      throw new RecommendationError(
        'ROUTE_MATRIX_UNAVAILABLE',
        'Google Routes API is not configured',
      );
    }
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
            origins: input.origins.map(toWaypoint),
            destinations: input.destinations.map(toWaypoint),
            travelMode: input.travelMode,
            routingPreference: input.routingPreference,
          }),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!response.ok) {
          if (response.status < 500 && response.status !== 429) break;
          throw new Error(`Google Routes HTTP ${response.status}`);
        }
        const payload = (await response.json()) as GoogleRouteElement[];
        if (!Array.isArray(payload)) throw new Error('Invalid route response');
        return normalize(payload, input);
      } catch {
        // The bounded retry loop handles timeout, network, 429 and 5xx failures.
      }
    }
    throw new RecommendationError(
      'ROUTE_MATRIX_UNAVAILABLE',
      'Google Routes could not compute the route matrix',
    );
  }
}

function toWaypoint(value: { latitude: number; longitude: number }) {
  return {
    waypoint: {
      location: {
        latLng: {
          latitude: value.latitude,
          longitude: value.longitude,
        },
      },
    },
  };
}

function normalize(
  elements: GoogleRouteElement[],
  input: RouteBatchRequest,
): RouteBatchResult {
  const features: RouteBatchResult['features'] = [];
  const failures: RouteBatchResult['failures'] = [];
  for (const element of elements) {
    const originIndex = asIndex(element.originIndex, input.origins.length);
    const destinationIndex = asIndex(
      element.destinationIndex,
      input.destinations.length,
    );
    if (originIndex === null || destinationIndex === null) {
      throw new RecommendationError(
        'ROUTE_MATRIX_UNAVAILABLE',
        'Google Routes returned an invalid matrix index',
      );
    }
    const participantId = input.origins[originIndex].participantId;
    const canonicalCandidateKey =
      input.destinations[destinationIndex].canonicalCandidateKey;
    const etaSeconds = parseDuration(element.duration);
    const staticDurationSeconds = parseDuration(element.staticDuration);
    const distanceMeters =
      typeof element.distanceMeters === 'number'
        ? element.distanceMeters
        : Number.NaN;
    const statusCode =
      typeof element.status?.code === 'number' ? element.status.code : 0;
    if (
      element.condition === 'ROUTE_EXISTS' &&
      statusCode === 0 &&
      Number.isFinite(etaSeconds) &&
      etaSeconds >= 0 &&
      Number.isFinite(distanceMeters) &&
      distanceMeters >= 0
    ) {
      features.push({
        participantId,
        canonicalCandidateKey,
        etaSeconds,
        distanceMeters,
        status: 'OK',
        ...(Number.isFinite(staticDurationSeconds) && staticDurationSeconds >= 0
          ? { staticDurationSeconds }
          : {}),
      });
    } else {
      failures.push({
        participantId,
        canonicalCandidateKey,
        status: 'NO_ROUTE',
        ...(typeof element.condition === 'string'
          ? { providerCode: element.condition }
          : statusCode
            ? { providerCode: String(statusCode) }
            : {}),
      });
    }
  }
  return { features, failures };
}

function asIndex(value: unknown, length: number): number | null {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) < length
    ? Number(value)
    : null;
}

function parseDuration(value: unknown): number {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?s$/.test(value))
    return Number.NaN;
  return Number(value.slice(0, -1));
}
