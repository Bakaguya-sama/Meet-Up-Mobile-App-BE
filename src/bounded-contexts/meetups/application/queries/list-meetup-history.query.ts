import type { RecommendationHistoryReader } from '../../../recommendations/application/public/recommendation-history-reader';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';
import { toMeetupHistoryItem } from '../dto/meetup-history-response.dto';

export class ListMeetupHistoryQuery {
  constructor(
    private readonly meetups: MeetupStorePort,
    private readonly recommendationHistory: RecommendationHistoryReader,
  ) {}

  async execute(actorId: string, offset: number, limit: number) {
    const page = await this.meetups.listFinishedHistory({
      actorId: actorId.toLowerCase(),
      offset,
      limit,
    });
    const references = page.items.map((item) => ({
      meetupId: item.id,
      runId: item.chosenRunId,
      recommendationPlaceId: item.chosenRecommendationPlaceId,
    }));
    const snapshots =
      await this.recommendationHistory.getSelectedPlaceSnapshots(references);
    const snapshotsByPlaceId = new Map(
      snapshots.map((snapshot) => [snapshot.recommendationPlaceId, snapshot]),
    );
    const items = page.items.map((meetup) => {
      const place = snapshotsByPlaceId.get(meetup.chosenRecommendationPlaceId);
      if (
        !place ||
        place.meetupId !== meetup.id ||
        place.runId !== meetup.chosenRunId
      ) {
        throw new Error('Selected recommendation snapshot is missing for finished meetup');
      }
      return toMeetupHistoryItem(meetup, place);
    });
    return { items, total: page.total, offset, limit };
  }
}
