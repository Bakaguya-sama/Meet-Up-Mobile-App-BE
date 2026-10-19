import { toMeetupDetail } from '../dto/meetup-response.dto';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';

export class RemoveParticipantUseCase {
  constructor(private readonly store: MeetupStorePort) {}
  async execute(actorId: string, meetupId: string, userId: string) {
    const state = await this.store.updateLocked(
      meetupId.toLowerCase(),
      (meetup) =>
        meetup.remove(actorId.toLowerCase(), userId.toLowerCase(), new Date()),
    );
    return toMeetupDetail(state);
  }
}
