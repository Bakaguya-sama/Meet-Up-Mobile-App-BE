import { applyWeatherPolicy } from './weather-policy';
import type { EligibleCandidate } from './candidate-filter';

const candidates: EligibleCandidate[] = [
  {
    canonicalCandidateKey: 'outdoor',
    provider: 'google',
    providerPlaceId: '1',
    name: 'Park',
    latitude: 10,
    longitude: 106,
    providerTypes: ['park'],
    sourceCategories: ['cafe'],
    sourcePages: [1],
    normalizedTags: [],
  },
  {
    canonicalCandidateKey: 'indoor',
    provider: 'google',
    providerPlaceId: '2',
    name: 'Cafe',
    latitude: 10,
    longitude: 106,
    providerTypes: ['cafe'],
    sourceCategories: ['cafe'],
    sourcePages: [1],
    normalizedTags: [],
  },
];
describe('applyWeatherPolicy', () => {
  const date = new Date('2026-11-10T10:00:00.000Z');
  it('does not call a provider when OFF', async () => {
    const provider = { forecast: jest.fn() };
    const outcome = await applyWeatherPolicy(candidates, date, 'OFF', provider);
    expect(provider.forecast).not.toHaveBeenCalled();
    expect(outcome.candidates).toHaveLength(2);
  });
  it('keeps candidates in WARN_ONLY', async () => {
    const outcome = await applyWeatherPolicy(candidates, date, 'WARN_ONLY', {
      forecast: () =>
        Promise.resolve({
          availability: 'AVAILABLE',
          severity: 1,
          provider: 'fake',
        }),
    });
    expect(outcome.candidates).toHaveLength(2);
  });
  it('filters only available unsuitable outdoor candidates and relaxes empty output', async () => {
    const outcome = await applyWeatherPolicy(
      candidates,
      date,
      'FILTER_OUTDOOR',
      {
        forecast: () =>
          Promise.resolve({
            availability: 'AVAILABLE',
            severity: 1,
            provider: 'fake',
          }),
      },
    );
    expect(
      outcome.candidates.map((candidate) => candidate.canonicalCandidateKey),
    ).toEqual(['indoor']);
    const relaxed = await applyWeatherPolicy(
      [candidates[0]],
      date,
      'FILTER_OUTDOOR',
      {
        forecast: () =>
          Promise.resolve({
            availability: 'AVAILABLE',
            severity: 1,
            provider: 'fake',
          }),
      },
    );
    expect(relaxed.effectivePolicy).toBe('WARN_ONLY');
    expect(relaxed.warnings).toContain('WEATHER_FILTER_RELAXED');
  });
  it.each(['UNAVAILABLE', 'OUT_OF_RANGE'] as const)(
    'retains candidates with %s evidence',
    async (availability) => {
      const outcome = await applyWeatherPolicy(
        candidates,
        date,
        'FILTER_OUTDOOR',
        {
          forecast: () => Promise.resolve({ availability, provider: 'fake' }),
        },
      );
      expect(outcome.candidates).toHaveLength(2);
    },
  );
  it('retains unknown exposure even when the forecast severity exceeds threshold', async () => {
    const unknown = [{ ...candidates[0], providerTypes: ['unknown_type'] }];
    const outcome = await applyWeatherPolicy(unknown, date, 'FILTER_OUTDOOR', {
      forecast: () =>
        Promise.resolve({
          availability: 'AVAILABLE',
          severity: 1,
          provider: 'fake',
        }),
    });
    expect(outcome.candidates).toHaveLength(1);
  });
});
