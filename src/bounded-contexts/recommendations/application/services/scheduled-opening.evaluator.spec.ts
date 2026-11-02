import { ScheduledOpeningEvaluator } from './scheduled-opening.evaluator';
import type { EligibleCandidate } from './candidate-filter';

const evaluator = new ScheduledOpeningEvaluator();

function candidate(patch: Partial<EligibleCandidate> = {}): EligibleCandidate {
  return {
    provider: 'google-places',
    providerPlaceId: 'place-1',
    name: 'Place',
    latitude: 10.7,
    longitude: 106.7,
    providerTypes: ['cafe'],
    sourceCategory: 'cafe',
    sourcePage: 1,
    canonicalCandidateKey: 'google-places:place-1',
    distanceFromSearchCenterMeters: 0,
    matchedRequiredCategories: ['cafe'],
    sourceCategories: ['cafe'],
    sourcePages: [1],
    normalizedTags: ['cafe'],
    ...patch,
  };
}

describe('ScheduledOpeningEvaluator', () => {
  it('uses current hours and the place timezone for OPEN and CLOSED', () => {
    const value = candidate({
      timeZoneId: 'Asia/Ho_Chi_Minh',
      currentOpeningHours: {
        source: 'CURRENT',
        coverageStartDate: '2026-10-30',
        coverageEndDate: '2026-11-05',
        periods: [
          {
            open: { day: 5, hour: 18, minute: 0, date: '2026-10-30' },
            close: { day: 5, hour: 22, minute: 0, date: '2026-10-30' },
          },
        ],
      },
      regularOpeningHours: {
        source: 'REGULAR',
        periods: [
          {
            open: { day: 5, hour: 0, minute: 0 },
            close: { day: 6, hour: 0, minute: 0 },
          },
        ],
      },
    });
    expect(
      evaluator.evaluate(value, new Date('2026-10-30T12:00:00Z')),
    ).toMatchObject({
      status: 'OPEN',
      evidence: {
        source: 'CURRENT',
        evaluatedLocalDateTime: '2026-10-30T19:00',
        fallbackToRegularHours: false,
      },
    });
    expect(
      evaluator.evaluate(value, new Date('2026-10-30T16:00:00Z')).status,
    ).toBe('CLOSED');
  });

  it('handles overnight and 24-hour regular periods', () => {
    const overnight = candidate({
      utcOffsetMinutes: 420,
      regularOpeningHours: {
        source: 'REGULAR',
        periods: [
          {
            open: { day: 5, hour: 22, minute: 0 },
            close: { day: 6, hour: 2, minute: 0 },
          },
        ],
      },
    });
    expect(
      evaluator.evaluate(overnight, new Date('2026-10-30T16:30:00Z')),
    ).toMatchObject({
      status: 'OPEN',
      warnings: ['OPENING_FROM_REGULAR_HOURS'],
    });
    expect(
      evaluator.evaluate(overnight, new Date('2026-10-30T18:00:00Z')).status,
    ).toBe('OPEN');
    expect(
      evaluator.evaluate(overnight, new Date('2026-10-30T20:00:00Z')).status,
    ).toBe('CLOSED');

    const alwaysOpen = candidate({
      timeZoneId: 'America/New_York',
      regularOpeningHours: {
        source: 'REGULAR',
        periods: [{ open: { day: 0, hour: 0, minute: 0 } }],
      },
    });
    expect(
      evaluator.evaluate(alwaysOpen, new Date('2026-11-01T10:00:00Z')).status,
    ).toBe('OPEN');
  });

  it.each([
    [
      'missing timezone',
      candidate({
        regularOpeningHours: {
          source: 'REGULAR',
          periods: [{ open: { day: 1, hour: 9, minute: 0 } }],
        },
      }),
    ],
    [
      'invalid timezone',
      candidate({
        timeZoneId: 'Invalid/Zone',
        regularOpeningHours: {
          source: 'REGULAR',
          periods: [{ open: { day: 1, hour: 9, minute: 0 } }],
        },
      }),
    ],
    ['missing hours', candidate({ utcOffsetMinutes: 420 })],
    [
      'invalid hours',
      candidate({
        utcOffsetMinutes: 420,
        regularOpeningHours: {
          source: 'REGULAR',
          periods: [{ open: { day: 8, hour: 9, minute: 0 } }],
        },
      }),
    ],
  ])('returns UNKNOWN for %s', (_label, value) => {
    expect(
      evaluator.evaluate(value, new Date('2026-10-30T12:00:00Z')),
    ).toMatchObject({
      status: 'UNKNOWN',
      evidence: { source: 'NONE' },
      warnings: ['OPENING_STATUS_UNKNOWN'],
    });
  });

  it('falls back to regular hours only outside current-hours coverage', () => {
    const value = candidate({
      utcOffsetMinutes: 420,
      currentOpeningHours: {
        source: 'CURRENT',
        coverageStartDate: '2026-10-20',
        coverageEndDate: '2026-10-26',
        periods: [
          {
            open: { day: 1, hour: 9, minute: 0, date: '2026-10-26' },
            close: { day: 1, hour: 17, minute: 0, date: '2026-10-26' },
          },
        ],
      },
      regularOpeningHours: {
        source: 'REGULAR',
        periods: [
          {
            open: { day: 5, hour: 18, minute: 0 },
            close: { day: 5, hour: 22, minute: 0 },
          },
        ],
      },
    });
    expect(
      evaluator.evaluate(value, new Date('2026-10-30T12:00:00Z')),
    ).toMatchObject({
      status: 'OPEN',
      evidence: { source: 'REGULAR', fallbackToRegularHours: true },
      warnings: ['OPENING_FROM_REGULAR_HOURS'],
    });
  });

  it('returns UNKNOWN when current-hours coverage cannot be established', () => {
    const value = candidate({
      utcOffsetMinutes: 420,
      currentOpeningHours: {
        source: 'CURRENT',
        periods: [
          {
            open: { day: 5, hour: 18, minute: 0 },
            close: { day: 5, hour: 22, minute: 0 },
          },
        ],
      },
      regularOpeningHours: {
        source: 'REGULAR',
        periods: [{ open: { day: 0, hour: 0, minute: 0 } }],
      },
    });

    expect(
      evaluator.evaluate(value, new Date('2026-10-30T12:00:00Z')),
    ).toMatchObject({
      status: 'UNKNOWN',
      evidence: {
        source: 'NONE',
        reason: 'MISSING_OR_INVALID_CURRENT_HOURS_COVERAGE',
      },
      warnings: ['OPENING_STATUS_UNKNOWN'],
    });
  });
});
