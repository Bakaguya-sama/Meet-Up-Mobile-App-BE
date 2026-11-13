import type {
  RecommendationFeedbackLedger,
  RecordFeedbackInput,
  RecordImpressionInput,
} from '../ports/recommendation-feedback-ledger.port';

/**
 * Application boundary for the immutable feedback ledger. The persistence adapter
 * owns transaction, authorization and database concurrency details.
 */
export class RecordRecommendationFeedbackUseCase {
  constructor(private readonly ledger: RecommendationFeedbackLedger) {}

  impression(
    actorId: string,
    meetupId: string,
    runId: string,
    input: RecordImpressionInput,
  ) {
    return this.ledger.recordImpression(actorId, meetupId, runId, input);
  }

  feedback(
    actorId: string,
    meetupId: string,
    runId: string,
    input: RecordFeedbackInput,
  ) {
    return this.ledger.recordFeedback(actorId, meetupId, runId, input);
  }
}
