import type { ClosingEvidence } from '../../domain/temporal-context';
import type { EligibleCandidate } from './candidate-filter';
import type { RecommendationConfig } from '../recommendation-config';

/** Evaluates only persisted scheduled-opening evidence; it never re-queries Places. */
export class ClosingSoonEvaluator {
  constructor(private readonly policy: RecommendationConfig['closingPolicy']) {}

  evaluate(
    candidate: Pick<
      EligibleCandidate,
      'scheduledOpeningStatus' | 'openingEvidence'
    >,
    scheduledAt: Date,
  ): ClosingEvidence {
    const unknown = (reason: string): ClosingEvidence => ({
      policyVersion: this.policy.version,
      status: 'UNKNOWN',
      nextClosingAt: null,
      secondsUntilClose: null,
      closingRisk: 0,
      closingPenalty: 0,
      reason,
    });
    if (!this.policy.enabled) return unknown('POLICY_DISABLED');
    if (candidate.scheduledOpeningStatus !== 'OPEN')
      return unknown('OPENING_NOT_CONFIRMED_OPEN');
    if (!Number.isFinite(scheduledAt.getTime())) return unknown('INVALID_SCHEDULED_AT');
    const evidence = candidate.openingEvidence;
    const close = evidence?.matchedPeriod?.close;
    if (!evidence || !close) return unknown('NEXT_CLOSING_UNAVAILABLE');
    const nextClosingAt = nextClosing(close, evidence, scheduledAt);
    if (!nextClosingAt || nextClosingAt.getTime() < scheduledAt.getTime())
      return unknown('NEXT_CLOSING_UNAVAILABLE');
    const secondsUntilClose = (nextClosingAt.getTime() - scheduledAt.getTime()) / 1000;
    const risk = Math.max(
      0,
      Math.min(1, 1 - secondsUntilClose / this.policy.closingSoonWindowSeconds),
    );
    const closingPenalty = this.policy.closingPenaltyWeight * risk;
    return {
      policyVersion: this.policy.version,
      status: risk > 0 ? 'CLOSING_SOON' : 'NOT_SOON',
      nextClosingAt: nextClosingAt.toISOString(),
      secondsUntilClose,
      closingRisk: risk,
      closingPenalty,
    };
  }
}

function nextClosing(
  close: { day: number; hour: number; minute: number; date?: string },
  evidence: NonNullable<EligibleCandidate['openingEvidence']>,
  scheduledAt: Date,
): Date | null {
  const offset = evidence.utcOffsetMinutes;
  if (!Number.isInteger(offset)) return null;
  const utcOffset = offset as number;
  if (evidence.source === 'CURRENT' && close.date) {
    const [year, month, day] = close.date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, close.hour, close.minute) - utcOffset * 60_000);
  }
  if (evidence.source !== 'REGULAR') return null;
  const local = new Date(scheduledAt.getTime() + utcOffset * 60_000);
  const scheduledDay = local.getUTCDay();
  let days = (close.day - scheduledDay + 7) % 7;
  const localCloseMinutes = close.hour * 60 + close.minute;
  const currentMinutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  if (days === 0 && localCloseMinutes <= currentMinutes) days = 7;
  const localClose = new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() + days,
      close.hour,
      close.minute,
    ),
  );
  return new Date(localClose.getTime() - utcOffset * 60_000);
}
