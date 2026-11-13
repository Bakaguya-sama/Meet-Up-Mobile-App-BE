export type RecommendationFeedbackEventType =
  | 'PLACE_VOTED'
  | 'VOTE_CHANGED'
  | 'MEETUP_PLACE_SELECTED'
  | 'NAVIGATION_OPENED'
  | 'FAVORITE_ADDED'
  | 'MEETUP_COMPLETED';

export interface RecordImpressionInput {
  eventId: string;
  canonicalCandidateKey: string;
  rank: number;
  shownAt: string;
}

export interface RecordFeedbackInput {
  eventId: string;
  eventType: RecommendationFeedbackEventType;
  canonicalCandidateKey?: string;
  fromCanonicalCandidateKey?: string;
  occurredAt: string;
}

export interface RecommendationFeedbackLedger {
  recordImpression(
    actorId: string,
    meetupId: string,
    runId: string,
    input: RecordImpressionInput,
  ): Promise<{ eventId: string; idempotent: boolean }>;
  recordFeedback(
    actorId: string,
    meetupId: string,
    runId: string,
    input: RecordFeedbackInput,
  ): Promise<{ eventId: string; idempotent: boolean }>;
}

export const RECOMMENDATION_FEEDBACK_LEDGER = Symbol(
  'RECOMMENDATION_FEEDBACK_LEDGER',
);
