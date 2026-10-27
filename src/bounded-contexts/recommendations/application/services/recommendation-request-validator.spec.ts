import { RECOMMENDATION_CONFIG_DEV_V1 } from '../recommendation-config';
import { validateRecommendationRequest } from './recommendation-request-validator';

describe('recommendation request validation', () => {
  const request = {
    requestId: 'aaaaaaaa-0000-4000-8000-000000000001',
    topK: 5,
    filters: {
      categories: ['cafe', 'restaurant'],
      openingFilter: 'ANY' as const,
      radiusMeters: 10_000,
    },
  };
  it('canonicalizes categories and produces a stable payload hash', () => {
    expect(
      validateRecommendationRequest(
        request,
        'BBBBBBBB-0000-4000-8000-000000000002',
        RECOMMENDATION_CONFIG_DEV_V1,
      ),
    ).toMatchObject({
      meetupId: 'bbbbbbbb-0000-4000-8000-000000000002',
      requiredCategories: ['cafe', 'restaurant'],
    });
  });
  it.each([
    { ...request, topK: 6 },
    { ...request, filters: { ...request.filters, radiusMeters: 10_001 } },
    {
      ...request,
      filters: { ...request.filters, categories: ['cafe', 'cafe'] },
    },
  ])('rejects unapproved limits', (invalid) => {
    expect(() =>
      validateRecommendationRequest(
        invalid,
        'meetup',
        RECOMMENDATION_CONFIG_DEV_V1,
      ),
    ).toThrow();
  });
});
