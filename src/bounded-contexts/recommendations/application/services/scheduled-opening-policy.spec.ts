import type { EligibleCandidate } from './candidate-filter';
import { ScheduledOpeningEvaluator } from './scheduled-opening.evaluator';
import { applyScheduledOpeningPolicy } from './scheduled-opening-policy';

function candidate(
  providerPlaceId: string,
  patch: Partial<EligibleCandidate> = {},
): EligibleCandidate {
  return {
    provider: 'google-places',
    providerPlaceId,
    name: providerPlaceId,
    latitude: 10.7,
    longitude: 106.7,
    providerTypes: ['cafe'],
    sourceCategory: 'cafe',
    sourcePage: 1,
    canonicalCandidateKey: `google-places:${providerPlaceId}`,
    distanceFromSearchCenterMeters: 0,
    matchedRequiredCategories: ['cafe'],
    sourceCategories: ['cafe'],
    sourcePages: [1],
    normalizedTags: ['cafe'],
    ...patch,
  };
}

describe('applyScheduledOpeningPolicy', () => {
  it('removes CLOSED, retains OPEN, and retains UNKNOWN with evidence', () => {
    const regularAlwaysOpen = {
      source: 'REGULAR' as const,
      periods: [{ open: { day: 0, hour: 0, minute: 0 } }],
    };
    const regularClosedAtScheduledTime = {
      source: 'REGULAR' as const,
      periods: [
        {
          open: { day: 2, hour: 1, minute: 0 },
          close: { day: 2, hour: 2, minute: 0 },
        },
      ],
    };
    const result = applyScheduledOpeningPolicy(
      [
        candidate('open', {
          utcOffsetMinutes: 0,
          regularOpeningHours: regularAlwaysOpen,
        }),
        candidate('closed', {
          utcOffsetMinutes: 0,
          regularOpeningHours: regularClosedAtScheduledTime,
        }),
        candidate('unknown'),
      ],
      new Date('2030-01-01T19:00:00.000Z'),
      new ScheduledOpeningEvaluator(),
    );

    expect(result.candidates.map((value) => value.providerPlaceId)).toEqual([
      'open',
      'unknown',
    ]);
    expect(result.candidates[0]).toMatchObject({
      scheduledOpeningStatus: 'OPEN',
    });
    expect(result.candidates[1]).toMatchObject({
      scheduledOpeningStatus: 'UNKNOWN',
      openingEvidence: { reason: 'MISSING_OR_INVALID_TIMEZONE' },
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'OPENING_FROM_REGULAR_HOURS',
        'OPENING_STATUS_UNKNOWN',
      ]),
    );
  });
});
