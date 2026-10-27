import { filterCandidates } from './candidate-filter';

describe('candidate residual filter', () => {
  const center = { latitude: 10.776, longitude: 106.7 };
  it('deduplicates canonically and retains unknown opening/rating and avoid-compatible candidates', () => {
    const result = filterCandidates(
      [
        {
          provider: 'google',
          providerPlaceId: 'a',
          name: 'A',
          latitude: 10.776,
          longitude: 106.7,
          providerTypes: ['cafe'],
          sourceCategory: 'cafe',
          sourcePage: 1,
        },
        {
          provider: 'google',
          providerPlaceId: 'a',
          name: 'A',
          latitude: 10.776,
          longitude: 106.7,
          providerTypes: ['restaurant'],
          sourceCategory: 'restaurant',
          sourcePage: 1,
        },
        {
          provider: 'google',
          providerPlaceId: 'closed',
          name: 'Closed',
          latitude: 10.776,
          longitude: 106.7,
          providerTypes: ['cafe'],
          sourceCategory: 'cafe',
          sourcePage: 1,
          businessStatus: 'CLOSED_PERMANENTLY',
        },
      ],
      center,
      1000,
      ['cafe', 'restaurant'],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      canonicalCandidateKey: 'google:a',
      matchedRequiredCategories: ['cafe', 'restaurant'],
    });
  });
  it('enforces exact backend radius', () => {
    expect(
      filterCandidates(
        [
          {
            provider: 'google',
            providerPlaceId: 'far',
            name: 'Far',
            latitude: 10.9,
            longitude: 106.7,
            providerTypes: ['cafe'],
            sourceCategory: 'cafe',
            sourcePage: 1,
          },
        ],
        center,
        1000,
        ['cafe'],
      ),
    ).toEqual([]);
  });
});
