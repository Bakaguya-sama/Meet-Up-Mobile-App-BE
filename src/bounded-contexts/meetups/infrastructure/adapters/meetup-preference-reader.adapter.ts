import { Inject, Injectable } from '@nestjs/common';
import {
  MeetupPreferenceReader,
  type ResolvedParticipantPreference,
} from '../../application/public/meetup-preference-reader';
import {
  MEETUP_STORE,
  type MeetupStorePort,
} from '../../application/ports/persistence/meetup-store.port';
import {
  PROFILE_PREFERENCE_FALLBACK,
  type ProfilePreferenceFallbackPort,
} from '../../application/ports/profile-preference-fallback.port';
import { resolveMeetupPreferences } from '../../application/services/resolve-meetup-preferences';

@Injectable()
export class TypeOrmMeetupPreferenceReader implements MeetupPreferenceReader {
  constructor(
    @Inject(MEETUP_STORE) private readonly store: MeetupStorePort,
    @Inject(PROFILE_PREFERENCE_FALLBACK)
    private readonly fallbackPort: ProfilePreferenceFallbackPort,
  ) {}
  async getEffectivePreferences(
    meetupId: string,
  ): Promise<ResolvedParticipantPreference[]> {
    const meetup = await this.store.findById(meetupId);
    if (!meetup) return [];
    const activeTags = await this.fallbackPort.getActiveTags();
    return Promise.all(
      meetup.participants
        .filter((p) => p.status === 'accepted')
        .map(async (p) => ({
          participantId: p.id,
          userId: p.userId,
          ...(await resolveMeetupPreferences(p, activeTags, this.fallbackPort)),
        })),
    );
  }
}
