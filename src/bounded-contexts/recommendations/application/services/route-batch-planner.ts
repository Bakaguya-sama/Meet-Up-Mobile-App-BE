import type {
  RouteBatchRequest,
  RouteDestination,
  RouteOrigin,
} from '../ports/route-matrix.port';
import { RecommendationError } from '../../domain/recommendation.error';

export interface PlannedRouteBatch extends RouteBatchRequest {
  batchIndex: number;
  elementCount: number;
}

export class RouteBatchPlanner {
  constructor(
    private readonly elementLimit = 625,
    private readonly waypointLimit: number | null = null,
  ) {
    if (
      !Number.isInteger(elementLimit) ||
      elementLimit <= 0 ||
      (waypointLimit !== null &&
        (!Number.isInteger(waypointLimit) || waypointLimit < 2))
    ) {
      throw new RecommendationError(
        'INVALID_RECOMMENDATION_CONFIG',
        'Route batch limits are invalid',
      );
    }
  }

  plan(
    originsInput: RouteOrigin[],
    destinationsInput: RouteDestination[],
  ): PlannedRouteBatch[] {
    if (!originsInput.length || !destinationsInput.length) return [];
    const origins = [...originsInput].sort((a, b) =>
      a.participantId.localeCompare(b.participantId),
    );
    const destinations = [...destinationsInput].sort((a, b) =>
      a.canonicalCandidateKey.localeCompare(b.canonicalCandidateKey),
    );
    assertUnique(
      origins.map((origin) => origin.participantId),
      'participant',
    );
    assertUnique(
      destinations.map((destination) => destination.canonicalCandidateKey),
      'candidate',
    );
    origins.forEach(assertCoordinate);
    destinations.forEach(assertCoordinate);
    const batches: PlannedRouteBatch[] = [];
    const modes: Array<RouteBatchRequest['travelMode']> = [
      'DRIVE',
      'TWO_WHEELER',
    ];
    for (const travelMode of modes) {
      const groupedOrigins = origins.filter(
        (origin) => (origin.travelMode ?? 'TWO_WHEELER') === travelMode,
      );
      if (!groupedOrigins.length) continue;
      const size = this.chooseChunkSize(
        groupedOrigins.length,
        destinations.length,
      );
      for (
        let originStart = 0;
        originStart < groupedOrigins.length;
        originStart += size.origins
      ) {
        for (
          let destinationStart = 0;
          destinationStart < destinations.length;
          destinationStart += size.destinations
        ) {
          const originChunk = groupedOrigins.slice(
            originStart,
            originStart + size.origins,
          );
          const destinationChunk = destinations.slice(
            destinationStart,
            destinationStart + size.destinations,
          );
          batches.push({
            batchIndex: batches.length,
            origins: originChunk,
            destinations: destinationChunk,
            travelMode,
            routingPreference: 'TRAFFIC_UNAWARE',
            elementCount: originChunk.length * destinationChunk.length,
          });
        }
      }
    }
    return batches;
  }

  private chooseChunkSize(originCount: number, destinationCount: number) {
    const choices: Array<{
      origins: number;
      destinations: number;
      requests: number;
      elements: number;
    }> = [];
    for (let origins = 1; origins <= originCount; origins += 1) {
      for (
        let destinations = 1;
        destinations <= destinationCount;
        destinations += 1
      ) {
        const elements = origins * destinations;
        if (elements > this.elementLimit) continue;
        if (
          this.waypointLimit !== null &&
          origins + destinations > this.waypointLimit
        )
          continue;
        choices.push({
          origins,
          destinations,
          requests:
            Math.ceil(originCount / origins) *
            Math.ceil(destinationCount / destinations),
          elements,
        });
      }
    }
    const selected = choices.sort(
      (a, b) =>
        a.requests - b.requests ||
        b.elements - a.elements ||
        b.origins - a.origins,
    )[0];
    if (!selected) {
      throw new RecommendationError(
        'INVALID_RECOMMENDATION_CONFIG',
        'No valid Route Matrix batch shape exists',
      );
    }
    return selected;
  }
}

function assertUnique(values: string[], kind: string) {
  if (new Set(values).size !== values.length) {
    throw new RecommendationError(
      'INVALID_ROUTE_MATRIX_INPUT',
      `Duplicate ${kind} identifier`,
    );
  }
}

function assertCoordinate(value: { latitude: number; longitude: number }) {
  if (
    !Number.isFinite(value.latitude) ||
    value.latitude < -90 ||
    value.latitude > 90 ||
    !Number.isFinite(value.longitude) ||
    value.longitude < -180 ||
    value.longitude > 180
  ) {
    throw new RecommendationError(
      'INVALID_ROUTE_MATRIX_INPUT',
      'Route Matrix coordinate is invalid',
    );
  }
}
