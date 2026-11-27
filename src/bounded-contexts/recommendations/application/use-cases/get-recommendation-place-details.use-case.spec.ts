import type { PlaceSearchPort } from '../ports/place-search.port';
import type { GetRecommendationRunUseCase } from './get-recommendation-run.use-case';
import { GetRecommendationPlaceDetailsUseCase } from './get-recommendation-place-details.use-case';

describe('GetRecommendationPlaceDetailsUseCase', () => {
  it('loads live details only for places in the authorized ranked run', async () => {
    const run = {
      id: 'run-1',
      results: [
        {
          rank: 1,
          canonicalCandidateKey: 'google-places:places/abc',
          candidate: {
            provider: 'google-places',
            providerPlaceId: 'places/abc',
          },
        },
        {
          rank: 2,
          canonicalCandidateKey: 'other:place-2',
          candidate: { provider: 'other', providerPlaceId: 'place-2' },
        },
      ],
    };
    const getRun = {
      execute: jest.fn().mockResolvedValue(run),
    } as unknown as GetRecommendationRunUseCase;
    const details = {
      provider: 'google-places',
      providerPlaceId: 'places/abc',
      name: 'Cafe Example',
      categories: ['cafe'],
      latitude: 10.7,
      longitude: 106.7,
      priceLevel: 'PRICE_LEVEL_MODERATE',
    };
    const places: jest.Mocked<PlaceSearchPort> = {
      search: jest.fn(),
      searchPage: jest.fn(),
      getDetails: jest.fn().mockResolvedValue(details),
    };
    const useCase = new GetRecommendationPlaceDetailsUseCase(getRun, places);

    await expect(
      useCase.execute('user-1', 'meetup-1', 'run-1'),
    ).resolves.toEqual({
      runId: 'run-1',
      items: [
        {
          rank: 1,
          canonicalCandidateKey: 'google-places:places/abc',
          details,
        },
        {
          rank: 2,
          canonicalCandidateKey: 'other:place-2',
          details: null,
        },
      ],
    });
    expect(getRun.execute).toHaveBeenCalledWith(
      'user-1',
      'meetup-1',
      'run-1',
    );
    expect(places.getDetails).toHaveBeenCalledTimes(1);
    expect(places.getDetails).toHaveBeenCalledWith('places/abc');
  });

  it('does not query details when run authorization fails', async () => {
    const getRun = {
      execute: jest.fn().mockRejectedValue(new Error('forbidden')),
    } as unknown as GetRecommendationRunUseCase;
    const places: jest.Mocked<PlaceSearchPort> = {
      search: jest.fn(),
      searchPage: jest.fn(),
      getDetails: jest.fn(),
    };
    const useCase = new GetRecommendationPlaceDetailsUseCase(getRun, places);

    await expect(
      useCase.execute('user-2', 'meetup-1', 'run-1'),
    ).rejects.toThrow('forbidden');
    expect(places.getDetails).not.toHaveBeenCalled();
  });
});
