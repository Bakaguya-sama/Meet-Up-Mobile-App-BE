import { OFFLINE_LABEL_VERSION, type OfflineLabel, type OfflineSourceFeedback } from './offline-evaluation.types';

export const FEEDBACK_LABEL_VERSION = OFFLINE_LABEL_VERSION;

/** Feedback is a label only. This policy must never be used while constructing feature vectors. */
export class FeedbackLabelPolicy {
  readonly version = FEEDBACK_LABEL_VERSION;

  label(events: readonly OfflineSourceFeedback[]): { label: OfflineLabel; rawEvents: Record<string, number> } {
    const rawEvents: Record<string, number> = {};
    let label: 0 | 1 | 2 | 3 = 0;
    for (const event of events) {
      rawEvents[event.eventType] = (rawEvents[event.eventType] ?? 0) + 1;
      label = Math.max(label, this.score(event.eventType)) as 0 | 1 | 2 | 3;
    }
    return { label, rawEvents };
  }

  private score(type: OfflineSourceFeedback['eventType']): 0 | 1 | 2 | 3 {
    switch (type) {
      case 'MEETUP_PLACE_SELECTED': return 3;
      case 'PLACE_VOTED':
      case 'VOTE_CHANGED': return 2;
      case 'FAVORITE_ADDED':
      case 'NAVIGATION_OPENED': return 1;
      case 'MEETUP_COMPLETED': return 0;
    }
  }
}
