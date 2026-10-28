import type {
  RouteDestination,
  RouteFailure,
  RouteFeature,
  RouteMatrixPort,
  RouteOrigin,
} from '../ports/route-matrix.port';
import { RecommendationError } from '../../domain/recommendation.error';
import { RouteBatchPlanner } from './route-batch-planner';

export interface RoutableCandidate {
  canonicalCandidateKey: string;
  routes: RouteFeature[];
}

export interface RouteMatrixOutcome {
  candidates: RoutableCandidate[];
  failures: RouteFailure[];
  effectiveK: number;
  warnings: string[];
  batchCount: number;
  elementCount: number;
}

export class RouteMatrixService {
  constructor(
    private readonly provider: RouteMatrixPort,
    private readonly planner: RouteBatchPlanner,
  ) {}

  async calculate(
    origins: RouteOrigin[],
    destinations: RouteDestination[],
    requestedK: number,
  ): Promise<RouteMatrixOutcome> {
    if (!Number.isInteger(requestedK) || requestedK <= 0) {
      throw new RecommendationError(
        'INVALID_ROUTE_MATRIX_INPUT',
        'requestedK must be a positive integer',
      );
    }
    const batches = this.planner.plan(origins, destinations);
    const featureByPair = new Map<string, RouteFeature>();
    const failureByPair = new Map<string, RouteFailure>();
    for (const batch of batches) {
      const result = await this.provider.calculateBatch(batch);
      for (const feature of result.features) {
        validateFeature(feature);
        insertUnique(featureByPair, pairKey(feature), feature);
      }
      for (const failure of result.failures) {
        insertUnique(failureByPair, pairKey(failure), failure);
      }
      for (const origin of batch.origins) {
        for (const destination of batch.destinations) {
          const key = pairKey({
            participantId: origin.participantId,
            canonicalCandidateKey: destination.canonicalCandidateKey,
          });
          if (!featureByPair.has(key) && !failureByPair.has(key)) {
            failureByPair.set(key, {
              participantId: origin.participantId,
              canonicalCandidateKey: destination.canonicalCandidateKey,
              status: 'NO_ROUTE',
              providerCode: 'MISSING_ELEMENT',
            });
          }
        }
      }
    }
    const candidates = destinations
      .map((destination) => {
        const routes = origins.flatMap((origin) => {
          const route = featureByPair.get(
            pairKey({
              participantId: origin.participantId,
              canonicalCandidateKey: destination.canonicalCandidateKey,
            }),
          );
          return route ? [route] : [];
        });
        return routes.length === origins.length
          ? { canonicalCandidateKey: destination.canonicalCandidateKey, routes }
          : null;
      })
      .filter((candidate): candidate is RoutableCandidate => !!candidate);
    if (!candidates.length) {
      throw new RecommendationError(
        'NO_ROUTABLE_CANDIDATES',
        'No candidate has a valid route for every member',
      );
    }
    const effectiveK = Math.min(requestedK, candidates.length);
    return {
      candidates,
      failures: [...failureByPair.values()].sort((a, b) =>
        pairKey(a).localeCompare(pairKey(b)),
      ),
      effectiveK,
      warnings:
        effectiveK < requestedK ? ['RESULT_COUNT_BELOW_REQUESTED_K'] : [],
      batchCount: batches.length,
      elementCount: origins.length * destinations.length,
    };
  }
}

function pairKey(value: {
  participantId: string;
  canonicalCandidateKey: string;
}) {
  return `${value.participantId}\u0000${value.canonicalCandidateKey}`;
}

function insertUnique<T>(map: Map<string, T>, key: string, value: T) {
  if (map.has(key)) {
    throw new RecommendationError(
      'ROUTE_MATRIX_UNAVAILABLE',
      'Route provider returned a duplicate matrix element',
    );
  }
  map.set(key, value);
}

function validateFeature(feature: RouteFeature) {
  if (
    !Number.isFinite(feature.etaSeconds) ||
    feature.etaSeconds < 0 ||
    !Number.isFinite(feature.distanceMeters) ||
    feature.distanceMeters < 0
  ) {
    throw new RecommendationError(
      'ROUTE_MATRIX_UNAVAILABLE',
      'Route provider returned an invalid numeric value',
    );
  }
}
