import type { RecommendationRunStore } from '../ports/recommendation-run-store.port';
import { CandidateGenerator } from '../services/candidate-generator';
import { RecommendationContextBuilder } from '../services/recommendation-context.builder';
import { CreateRecommendationRunUseCase } from './create-recommendation-run.use-case';
import { RouteMatrixService } from '../services/route-matrix.service';
import { RouteBatchPlanner } from '../services/route-batch-planner';
import { MemberUtilityService } from '../services/member-utility.service';
import { GroupRankerService } from '../services/group-ranker.service';
import { RECOMMENDATION_CONFIG_DEV_V1 } from '../recommendation-config';
const input = {
  requestId: 'aaaaaaaa-0000-4000-8000-000000000001',
  topK: 2,
  filters: {
    categories: ['cafe'],
    openingFilter: 'ANY' as const,
    radiusMeters: 1000,
  },
};
describe('recommendation run orchestration', () => {
  it('completes once, returns the stored run on retry, and rejects payload reuse', async () => {
    let stored: Awaited<ReturnType<RecommendationRunStore['findByRequest']>> =
      null;
    const store: RecommendationRunStore = {
      findByRequest: () => Promise.resolve(stored),
      findById: () => Promise.resolve(stored),
      create: (run) => {
        stored = { ...run, candidates: [], memberFeatures: [], places: [] };
        return Promise.resolve(stored);
      },
      complete: (runId, completion, completedAt) => {
        if (!stored) throw new Error('run fixture not initialized');
        stored = {
          ...stored,
          id: runId,
          status: 'COMPLETED',
          completedAt,
          effectiveK: completion.effectiveK,
          warnings: completion.warnings,
          randomSeed: completion.randomSeed,
          routeBatchCount: completion.routeBatchCount,
          routeElementCount: completion.routeElementCount,
          candidates: completion.candidates,
          memberFeatures: completion.memberFeatures,
          places: completion.places,
        };
        return Promise.resolve(stored);
      },
      fail: () => Promise.resolve(),
    };
    const contexts = {
      build: () =>
        Promise.resolve({
          meetupId: 'bbbbbbbb-0000-4000-8000-000000000002',
          requestedAt: '2026-10-27T00:00:00.000Z',
          scheduledAt: '2026-10-28T00:00:00.000Z',
          members: [
            {
              participantId: 'p1',
              latitude: 10.7,
              longitude: 106.7,
              preferences: [],
            },
            {
              participantId: 'p2',
              latitude: 10.71,
              longitude: 106.7,
              preferences: [],
            },
          ],
          searchCenter: { latitude: 10.7, longitude: 106.7 },
        }),
    } as unknown as RecommendationContextBuilder;
    const candidates = {
      generate: () =>
        Promise.resolve([
          {
            provider: 'google-places',
            providerPlaceId: 'place-1',
            name: 'Cafe',
            latitude: 10.7,
            longitude: 106.7,
            providerTypes: ['cafe'],
            sourceCategory: 'cafe',
            sourcePage: 1,
          },
        ]),
    } as unknown as CandidateGenerator;
    const useCase = new CreateRecommendationRunUseCase(
      store,
      contexts,
      candidates,
      undefined,
      () => new Date('2026-10-27T00:00:00Z'),
      new RouteMatrixService(
        {
          calculateBatch: (batch) =>
            Promise.resolve({
              features: batch.origins.flatMap((origin) =>
                batch.destinations.map((destination) => ({
                  participantId: origin.participantId,
                  canonicalCandidateKey: destination.canonicalCandidateKey,
                  etaSeconds: 300,
                  distanceMeters: 1000,
                  status: 'OK' as const,
                })),
              ),
              failures: [],
            }),
        },
        new RouteBatchPlanner(),
      ),
      new MemberUtilityService(RECOMMENDATION_CONFIG_DEV_V1),
      new GroupRankerService(RECOMMENDATION_CONFIG_DEV_V1),
    );
    const created = await useCase.execute(
      'actor',
      'bbbbbbbb-0000-4000-8000-000000000002',
      input,
    );
    expect(created).toMatchObject({
      requestedAt: new Date('2026-10-27T00:00:00.000Z'),
      scheduledAtSnapshot: new Date('2026-10-28T00:00:00.000Z'),
      contextStatus: 'CURRENT_CONTEXT',
    });
    expect(
      created.results[0].memberResults.map((feature) => feature.etaSeconds),
    ).toEqual([300, 300]);
    await expect(
      useCase.execute('actor', created.meetupId, input),
    ).resolves.toEqual(created);
    await expect(
      useCase.execute('actor', created.meetupId, { ...input, topK: 3 }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });
});
