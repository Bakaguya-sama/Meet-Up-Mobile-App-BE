import type { MeetupHistoryRecord } from '../ports/persistence/meetup-store.port';
import type { SelectedPlaceHistorySnapshot } from '../../../recommendations/application/public/recommendation-history-reader';

export function toMeetupHistoryItem(
  meetup: MeetupHistoryRecord,
  place: SelectedPlaceHistorySnapshot,
) {
  return {
    meetupId: meetup.id,
    title: meetup.title,
    description: meetup.description,
    scheduledAt: meetup.scheduledAt.toISOString(),
    finishedAt: meetup.finishedAt.toISOString(),
    selectedPlace: {
      recommendationPlaceId: place.recommendationPlaceId,
      canonicalCandidateKey: place.canonicalCandidateKey,
      provider: place.provider,
      providerPlaceId: place.providerPlaceId,
      name: place.name,
    },
  };
}
