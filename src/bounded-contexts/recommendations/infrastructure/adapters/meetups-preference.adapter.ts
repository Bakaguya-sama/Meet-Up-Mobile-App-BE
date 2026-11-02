import type { MeetupPreferenceReader } from '../../../meetups/application/public/meetup-preference-reader';
import type { MeetupPreferencePort } from '../../application/ports/meetup-preference.port';

export class MeetupsPreferenceAdapter implements MeetupPreferencePort {
  constructor(private readonly reader: MeetupPreferenceReader) {}

  async getEffectivePreferences(meetupId: string) {
    const values = await this.reader.getEffectivePreferences(meetupId);
    return values.map((value) => ({
      participantId: value.participantId,
      tags: value.tags.map((tag) => ({
        tagCode: tag.tagCode,
        level: tag.level,
        source: tag.source,
      })),
    }));
  }
}
