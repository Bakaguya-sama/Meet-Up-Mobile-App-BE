import type {
  RouteBatchRequest,
  RouteMatrixPort,
} from '../ports/route-matrix.port';
import { RecommendationError } from '../../domain/recommendation.error';
import { RouteBatchPlanner } from './route-batch-planner';
import { RouteMatrixService } from './route-matrix.service';

describe('RouteMatrixService', () => {
  const origins = ['p1', 'p2'].map((participantId, index) => ({
    participantId,
    latitude: 10 + index / 100,
    longitude: 106,
  }));
  const destinations = ['c1', 'c2'].map((canonicalCandidateKey, index) => ({
    canonicalCandidateKey,
    latitude: 10,
    longitude: 106 + index / 100,
  }));

  it('assembles out-of-order batches, filters NO_ROUTE, and reports effectiveK', async () => {
    const provider: RouteMatrixPort = {
      calculateBatch: (input: RouteBatchRequest) => {
        const features = input.origins.flatMap((origin) =>
          input.destinations
            .filter(
              (destination) =>
                !(
                  origin.participantId === 'p2' &&
                  destination.canonicalCandidateKey === 'c2'
                ),
            )
            .map((destination) => ({
              participantId: origin.participantId,
              canonicalCandidateKey: destination.canonicalCandidateKey,
              etaSeconds: 100,
              distanceMeters: 1_000,
              status: 'OK' as const,
            })),
        );
        const failures =
          input.origins.some((origin) => origin.participantId === 'p2') &&
          input.destinations.some(
            (destination) => destination.canonicalCandidateKey === 'c2',
          )
            ? [
                {
                  participantId: 'p2',
                  canonicalCandidateKey: 'c2',
                  status: 'NO_ROUTE' as const,
                },
              ]
            : [];
        return Promise.resolve({ features: features.reverse(), failures });
      },
    };
    const result = await new RouteMatrixService(
      provider,
      new RouteBatchPlanner(1),
    ).calculate(origins, destinations, 2);
    expect(
      result.candidates.map((candidate) => candidate.canonicalCandidateKey),
    ).toEqual(['c1']);
    expect(result.effectiveK).toBe(1);
    expect(result.warnings).toEqual(['RESULT_COUNT_BELOW_REQUESTED_K']);
    expect(result.elementCount).toBe(4);
    expect(result.batchCount).toBe(4);
  });

  it('fails when no candidate has all routes', async () => {
    const provider: RouteMatrixPort = {
      calculateBatch: (input) =>
        Promise.resolve({
          features: [],
          failures: input.origins.flatMap((origin) =>
            input.destinations.map((destination) => ({
              participantId: origin.participantId,
              canonicalCandidateKey: destination.canonicalCandidateKey,
              status: 'NO_ROUTE' as const,
            })),
          ),
        }),
    };
    await expect(
      new RouteMatrixService(provider, new RouteBatchPlanner()).calculate(
        origins,
        destinations,
        2,
      ),
    ).rejects.toMatchObject<Partial<RecommendationError>>({
      code: 'NO_ROUTABLE_CANDIDATES',
    });
  });

  it('discards all traffic-aware results and retries the whole matrix unaware', async () => {
    const calls: string[] = [];
    const provider: RouteMatrixPort = {
      calculateBatch: (input) => {
        calls.push(
          `${input.routingPreference}:${input.origins.map((origin) => origin.participantId).join(',')}`,
        );
        if (
          input.routingPreference === 'TRAFFIC_AWARE' &&
          input.origins.some((origin) => origin.participantId === 'p2')
        )
          throw new Error('traffic failure');
        return Promise.resolve({
          features: input.origins.flatMap((origin) =>
            input.destinations.map((destination) => ({
              participantId: origin.participantId,
              canonicalCandidateKey: destination.canonicalCandidateKey,
              etaSeconds:
                input.routingPreference === 'TRAFFIC_AWARE' ? 200 : 100,
              distanceMeters: 1000,
              status: 'OK' as const,
              staticDurationSeconds: 80,
            })),
          ),
          failures: [],
        });
      },
    };
    const result = await new RouteMatrixService(
      provider,
      new RouteBatchPlanner(1),
      'TRAFFIC_AWARE',
    ).calculate(origins, destinations, 2);
    expect(result.effectiveRoutingPreference).toBe('TRAFFIC_UNAWARE');
    expect(result.warnings).toContain('TRAFFIC_DATA_UNAVAILABLE');
    expect(
      result.candidates
        .flatMap((candidate) => candidate.routes)
        .every((route) => route.etaSeconds === 100),
    ).toBe(true);
    expect(
      calls.filter((call) => call.startsWith('TRAFFIC_UNAWARE')),
    ).toHaveLength(4);
  });

  it('returns ROUTE_MATRIX_UNAVAILABLE when the unaware fallback also fails', async () => {
    const provider: RouteMatrixPort = {
      calculateBatch: () => Promise.reject(new Error('provider down')),
    };
    await expect(
      new RouteMatrixService(
        provider,
        new RouteBatchPlanner(),
        'TRAFFIC_AWARE',
      ).calculate(origins, destinations, 2),
    ).rejects.toMatchObject({ code: 'ROUTE_MATRIX_UNAVAILABLE' });
  });
});
