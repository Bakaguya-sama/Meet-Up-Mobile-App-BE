import type { NormalizedOpeningPeriod } from './opening-hours';

export type RecommendationContextStatus = 'CURRENT_CONTEXT' | 'STALE_CONTEXT';

export type ScheduledOpeningStatus = 'OPEN' | 'CLOSED' | 'UNKNOWN';

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
