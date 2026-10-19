import { toMeetupDetail } from '../dto/meetup-response.dto';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';

export class RespondInvitationUseCase {
  constructor(private readonly store: MeetupStorePort) {}
  async execute(
    actorId: string,
    meetupId: string,
    decision: 'accepted' | 'declined',
  ) {
    const state = await this.store.updateLocked(
      meetupId.toLowerCase(),
      (meetup) => meetup.respond(actorId.toLowerCase(), decision, new Date()),
    );
    return toMeetupDetail(state);
  }
}
