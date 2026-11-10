import type { NormalizedOpeningPeriod } from './opening-hours';

export type RecommendationContextStatus = 'CURRENT_CONTEXT' | 'STALE_CONTEXT';

export type ScheduledOpeningStatus = 'OPEN' | 'CLOSED' | 'UNKNOWN';

export type ClosingStatus = 'NOT_SOON' | 'CLOSING_SOON' | 'UNKNOWN';

export interface ClosingEvidence {
  policyVersion: string;
  status: ClosingStatus;
  nextClosingAt: string | null;
  secondsUntilClose: number | null;
  closingRisk: number;
  closingPenalty: number;
  reason?: string;
}

export interface ScheduledOpeningEvidence {
  evaluatorVersion: string;
  source: 'CURRENT' | 'REGULAR' | 'NONE';
  evaluatedLocalDateTime?: string;
  timeZoneId?: string;
  utcOffsetMinutes?: number;
  matchedPeriod?: NormalizedOpeningPeriod;
  fallbackToRegularHours: boolean;
  reason?: string;
}
