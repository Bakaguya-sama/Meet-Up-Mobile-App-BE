import { MeetupError } from '../../domain/errors/meetup.error';
import { toMeetupDetail } from '../dto/meetup-response.dto';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';

export class GetMeetupDetailQuery {
  constructor(private readonly store: MeetupStorePort) {}
  async execute(actorId: string, meetupId: string) {
    const state = await this.store.findVisible(
      meetupId.toLowerCase(),
      actorId.toLowerCase(),
    );
    if (!state) throw new MeetupError('MEETUP_NOT_FOUND', 'Meetup not found');
    return toMeetupDetail(state);
  }
}
