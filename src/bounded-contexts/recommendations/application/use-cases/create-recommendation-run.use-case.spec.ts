import type { RecommendationRunStore } from '../ports/recommendation-run-store.port';
import { CandidateGenerator } from '../services/candidate-generator';
import { RecommendationContextBuilder } from '../services/recommendation-context.builder';
import { CreateRecommendationRunUseCase } from './create-recommendation-run.use-case';
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
        stored = { ...run, candidates: [] };
        return Promise.resolve(stored);
      },
      complete: (runId, candidates, completedAt) => {
        if (!stored) throw new Error('run fixture not initialized');
        stored = {
          ...stored,
          id: runId,
          status: 'COMPLETED',
          completedAt,
          candidates,
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
          members: [],
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
    );
    const created = await useCase.execute(
      'actor',
      'bbbbbbbb-0000-4000-8000-000000000002',
      input,
    );
    await expect(
      useCase.execute('actor', created.meetupId, input),
    ).resolves.toEqual(created);
    await expect(
      useCase.execute('actor', created.meetupId, { ...input, topK: 3 }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });
});
