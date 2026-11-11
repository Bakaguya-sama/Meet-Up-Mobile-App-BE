import { RECOMMENDATION_CONFIG_DEV_V1 } from '../recommendation-config';
import { MemberUtilityService } from './member-utility.service';

function expectCode(action: () => unknown, code: string) {
  try {
    action();
    throw new Error('Expected action to throw');
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}

describe('MemberUtilityService', () => {
  it('does not use staticDurationSeconds when scoring travel utility', () => {
    const service = new MemberUtilityService(RECOMMENDATION_CONFIG_DEV_V1);
    const base = {
      participantId: 'p1',
      canonicalCandidateKey: 'c1',
      etaSeconds: 600,
      distanceMeters: 1000,
      placeTags: [],
      preferences: [],
      rating0To5: null,
      userRatingCount: null,
    };
    expect(
      service.score({ ...base, staticDurationSeconds: 300 }).travelUtility,
    ).toBe(
      service.score({ ...base, staticDurationSeconds: 9_000 }).travelUtility,
    );
  });
  it('matches every documented golden vector including avoid soft penalty', () => {
    const result = new MemberUtilityService(RECOMMENDATION_CONFIG_DEV_V1).score(
      {
        participantId: 'p1',
        canonicalCandidateKey: 'c1',
        etaSeconds: 600,
        distanceMeters: 1000,
        placeTags: ['coffee', 'quiet'],
        preferences: [
          { tagCode: 'coffee', level: 'high' },
          { tagCode: 'quiet', level: 'avoid' },
        ],
        rating0To5: 4.5,
        userRatingCount: 99,
      },
    );
    expect(result.travelUtility).toBeCloseTo(0.607, 3);
    expect(result.preferenceUtility).toBeCloseTo(0.55, 10);
    expect(result.placeQualityUtility).toBeCloseTo(0.6, 10);
    expect(result.memberUtility).toBeCloseTo(0.5892, 3);
    expect(result.matchedTags).toEqual([
      { tagCode: 'coffee', level: 'high', weight: 1 },
      { tagCode: 'quiet', level: 'avoid', weight: 1 },
    ]);
  });

  it('uses missing values and never divides by zero', () => {
    const result = new MemberUtilityService(RECOMMENDATION_CONFIG_DEV_V1).score(
      {
        participantId: 'p1',
        canonicalCandidateKey: 'c1',
        etaSeconds: 0,
        distanceMeters: 0,
        placeTags: [],
        preferences: [],
        rating0To5: null,
        userRatingCount: null,
      },
    );
    expect(result.preferenceUtility).toBe(0.6);
    expect(result.placeQualityUtility).toBe(0.6);
    expect(result.missingFlags).toEqual(['PREFERENCE', 'PLACE_QUALITY']);
  });

  it.each([
    { tauSeconds: 0 },
    { utilityTieEpsilon: 0 },
    { monteCarloSamples: 0 },
    { tagWeights: { cafe: 0 } },
    { utilityWeights: { travel: 0.6, preference: 0.6, quality: 0.1 } },
  ])('rejects invalid config %o', (override) => {
    expectCode(
      () =>
        new MemberUtilityService({
          ...RECOMMENDATION_CONFIG_DEV_V1,
          ...override,
        }),
      'INVALID_RECOMMENDATION_CONFIG',
    );
  });

  it('rejects invalid route numerics', () => {
    const service = new MemberUtilityService(RECOMMENDATION_CONFIG_DEV_V1);
    expectCode(
      () =>
        service.score({
          participantId: 'p1',
          canonicalCandidateKey: 'c1',
          etaSeconds: Number.NaN,
          distanceMeters: 0,
          placeTags: [],
          preferences: [],
          rating0To5: null,
          userRatingCount: null,
        }),
      'INVALID_RECOMMENDATION_NUMERIC',
    );
  });

  it.each([
    [Number.NaN, 10],
    [Number.POSITIVE_INFINITY, 10],
    [5.1, 10],
    [4, -1],
    [4, 1.5],
  ])('rejects invalid provider quality values (%s, %s)', (rating, reviews) => {
    expectCode(
      () =>
        new MemberUtilityService(RECOMMENDATION_CONFIG_DEV_V1).score({
          participantId: 'p1',
          canonicalCandidateKey: 'c1',
          etaSeconds: 1,
          distanceMeters: 1,
          placeTags: [],
          preferences: [],
          rating0To5: rating,
          userRatingCount: reviews,
        }),
      'INVALID_RECOMMENDATION_NUMERIC',
    );
  });
});
