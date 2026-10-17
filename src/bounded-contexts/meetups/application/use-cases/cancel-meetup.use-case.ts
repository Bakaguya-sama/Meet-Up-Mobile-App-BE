import { toMeetupDetail } from '../dto/meetup-response.dto';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';

export class CancelMeetupUseCase {
  constructor(private readonly store: MeetupStorePort) {}
  async execute(actorId: string, meetupId: string) {
    const state = await this.store.updateLocked(
      meetupId.toLowerCase(),
      (meetup) => meetup.cancel(actorId.toLowerCase(), new Date()),
    );
    return toMeetupDetail(state);
  }
}
