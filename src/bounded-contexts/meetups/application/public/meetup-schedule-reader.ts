import { MeetupError } from '../../domain/errors/meetup.error';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';

/** Public temporal contract; no meetup aggregate or persistence model escapes. */
export class MeetupScheduleReader {
  constructor(private readonly store: MeetupStorePort) {}

  async getScheduledAt(meetupId: string): Promise<Date> {
    const meetup = await this.store.findById(meetupId.toLowerCase());
    if (!meetup) {
      throw new MeetupError('MEETUP_NOT_FOUND', 'Meetup not found');
    }
    return new Date(meetup.scheduledAt);
  }
}
