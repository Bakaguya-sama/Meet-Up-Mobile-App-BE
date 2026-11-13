import { RECOMMENDATION_CONFIG_DEV_V1 } from '../recommendation-config';
import { ClosingSoonEvaluator } from './closing-soon.evaluator';

const scheduledAt = new Date('2026-11-10T10:00:00.000Z');
const openCandidate = (closeHour: number) => ({
  scheduledOpeningStatus: 'OPEN' as const,
  openingEvidence: {
    evaluatorVersion: 'opening',
    source: 'CURRENT' as const,
    utcOffsetMinutes: 0,
    fallbackToRegularHours: false,
    matchedPeriod: {
      open: { day: 1, hour: 9, minute: 0, date: '2026-11-10' },
      close: { day: 1, hour: closeHour, minute: 0, date: '2026-11-10' },
    },
  },
});

describe('ClosingSoonEvaluator', () => {
  const evaluator = new ClosingSoonEvaluator(
    RECOMMENDATION_CONFIG_DEV_V1.closingPolicy,
  );

  it('keeps an open candidate and applies a proportional risk only inside the window', () => {
    const result = evaluator.evaluate(openCandidate(11), scheduledAt);
    expect(result).toMatchObject({
      status: 'CLOSING_SOON',
      secondsUntilClose: 3600,
    });
    expect(result.closingPenalty).toBeGreaterThan(0);
    expect(result.closingPenalty).toBeLessThanOrEqual(0.15);
  });

  it('does not penalize closing outside the window or unknown opening evidence', () => {
    expect(evaluator.evaluate(openCandidate(13), scheduledAt)).toMatchObject({
      status: 'NOT_SOON',
      closingPenalty: 0,
    });
    expect(
      evaluator.evaluate({ scheduledOpeningStatus: 'UNKNOWN' }, scheduledAt),
    ).toMatchObject({
      status: 'UNKNOWN',
      closingPenalty: 0,
    });
  });

  it('assigns the maximum penalty at the closing boundary and never penalizes a closed candidate', () => {
    expect(evaluator.evaluate(openCandidate(10), scheduledAt)).toMatchObject({
      status: 'CLOSING_SOON',
      secondsUntilClose: 0,
      closingRisk: 1,
      closingPenalty: 0.15,
    });
    expect(
      evaluator.evaluate({ scheduledOpeningStatus: 'CLOSED' }, scheduledAt),
    ).toMatchObject({ status: 'UNKNOWN', closingPenalty: 0 });
  });
});
