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

@Injectable()
export class TypeOrmMeetupPreferenceReader implements MeetupPreferenceReader {
  constructor(
    @Inject(MEETUP_STORE)
    private readonly store: MeetupStorePort,
    @Inject(PROFILE_PREFERENCE_FALLBACK)
    private readonly fallbackPort: ProfilePreferenceFallbackPort,
  ) {}

  async getEffectivePreferences(
    meetupId: string,
  ): Promise<ResolvedParticipantPreference[]> {
    const activeTags = await this.fallbackPort.getActiveTags();
    const meetup = await this.store.findById(meetupId);
    if (!meetup) {
      return [];
    }

    const acceptedParticipants = meetup.participants.filter(
      (p) => p.status === 'accepted',
    );

    return Promise.all(
      acceptedParticipants.map(async (p) => {
        const hasExplicit =
          Array.isArray(p.preferences) && p.preferences.length > 0;

        if (hasExplicit) {
          const explicitMap = new Map(
            p.preferences!.map((pref) => [pref.activityTagId, pref]),
          );
          let profileTagsMap: Map<number, string> | null = null;

          const tags = await Promise.all(
            activeTags.map(async (tag) => {
              const explicit = explicitMap.get(tag.id);
              if (explicit) {
                return {
                  activityTagId: tag.id,
                  tagCode: tag.code,
                  displayName: tag.displayName,
                  level: explicit.level,
                  source: explicit.source,
                };
              }
              if (!profileTagsMap) {
                const profilePrefs =
                  await this.fallbackPort.getProfilePreference(p.userId);
                profileTagsMap = new Map(
                  (profilePrefs ?? []).map((pref) => [
                    pref.activityTagId,
                    pref.level,
                  ]),
                );
              }
              return {
                activityTagId: tag.id,
                tagCode: tag.code,
                displayName: tag.displayName,
                level: (profileTagsMap.get(tag.id) ?? 'normal') as
                  'high' | 'normal' | 'avoid',
                source: 'profile_fallback' as const,
              };
            }),
          );

          return {
            participantId: p.id,
            userId: p.userId,
            hasExplicitMeetupPreference: true,
            tags,
          };
        }

        const profilePrefs = await this.fallbackPort.getProfilePreference(
          p.userId,
        );
        const profileMap = new Map(
          (profilePrefs ?? []).map((pref) => [pref.activityTagId, pref.level]),
        );

        return {
          participantId: p.id,
          userId: p.userId,
          hasExplicitMeetupPreference: false,
          tags: activeTags.map((tag) => ({
            activityTagId: tag.id,
            tagCode: tag.code,
            displayName: tag.displayName,
            level: profileMap.get(tag.id) ?? 'normal',
            source: 'profile_fallback' as const,
          })),
        };
      }),
    );
  }
}
