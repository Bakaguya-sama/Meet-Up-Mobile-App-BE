import { MeetupError } from '../../domain/errors/meetup.error';
import type {
  MeetupPreferencesSummaryResponseDto,
  ParticipantPreferenceSummaryItemDto,
} from '../dto/meetup-response.dto';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';
import type { ProfilePreferenceFallbackPort } from '../ports/profile-preference-fallback.port';

export class GetMeetupPreferencesSummaryQuery {
  constructor(
    private readonly store: MeetupStorePort,
    private readonly fallbackPort: ProfilePreferenceFallbackPort,
  ) {}

  async execute(
    actorId: string,
    meetupId: string,
  ): Promise<MeetupPreferencesSummaryResponseDto> {
    actorId = actorId.toLowerCase();
    const state = await this.store.findVisible(meetupId, actorId);
    if (!state) {
      throw new MeetupError('MEETUP_NOT_FOUND', 'Meetup not found');
    }

    const activeTags = await this.fallbackPort.getActiveTags();
    const activeParticipants = state.participants.filter((p) =>
      ['invited', 'accepted'].includes(p.status),
    );

    let submittedCount = 0;
    let fallbackCount = 0;

    const participants: ParticipantPreferenceSummaryItemDto[] =
      await Promise.all(
        activeParticipants.map(async (p) => {
          const hasExplicit =
            Array.isArray(p.preferences) && p.preferences.length > 0;
          if (hasExplicit) {
            submittedCount++;
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
                    updatedAt: explicit.updatedAt.toISOString(),
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
                  updatedAt: null,
                };
              }),
            );

            return {
              participantId: p.id,
              userId: p.userId,
              status: p.status,
              hasExplicitMeetupPreference: true,
              source: 'meetup_input' as const,
              tags,
            };
          }

          fallbackCount++;
          const profilePrefs = await this.fallbackPort.getProfilePreference(
            p.userId,
          );
          const profileMap = new Map(
            (profilePrefs ?? []).map((pref) => [
              pref.activityTagId,
              pref.level,
            ]),
          );

          return {
            participantId: p.id,
            userId: p.userId,
            status: p.status,
            hasExplicitMeetupPreference: false,
            source: 'profile_fallback' as const,
            tags: activeTags.map((tag) => ({
              activityTagId: tag.id,
              tagCode: tag.code,
              displayName: tag.displayName,
              level: profileMap.get(tag.id) ?? 'normal',
              source: 'profile_fallback' as const,
              updatedAt: null,
            })),
          };
        }),
      );

    return {
      meetupId: state.id,
      totalParticipants: activeParticipants.length,
      submittedCount,
      fallbackCount,
      participants,
    };
  }
}
