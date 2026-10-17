import { MeetupError } from '../../domain/errors/meetup.error';
import type { MeetupMemberPreferenceResponseDto } from '../dto/meetup-response.dto';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';
import type { ProfilePreferenceFallbackPort } from '../ports/profile-preference-fallback.port';

export class GetMeetupMemberPreferenceUseCase {
  constructor(
    private readonly store: MeetupStorePort,
    private readonly fallbackPort: ProfilePreferenceFallbackPort,
  ) {}

  async execute(
    actorId: string,
    meetupId: string,
    targetUserId?: string,
  ): Promise<MeetupMemberPreferenceResponseDto> {
    actorId = actorId.toLowerCase();
    const state = await this.store.findVisible(meetupId, actorId);
    if (!state) {
      throw new MeetupError('MEETUP_NOT_FOUND', 'Meetup not found');
    }

    const targetId = (targetUserId ?? actorId).toLowerCase();
    const participant = state.participants.find(
      (p) =>
        p.userId === targetId && ['invited', 'accepted'].includes(p.status),
    );
    if (!participant) {
      throw new MeetupError(
        'MEETUP_NOT_FOUND',
        'Participant not found or no longer active in meetup',
      );
    }

    const activeTags = await this.fallbackPort.getActiveTags();
    const hasExplicit =
      Array.isArray(participant.preferences) &&
      participant.preferences.length > 0;

    if (hasExplicit) {
      const explicitMap = new Map(
        participant.preferences!.map((p) => [p.activityTagId, p]),
      );
      // For any active tag missing from explicit meetup input, fall back to profile
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
              await this.fallbackPort.getProfilePreference(targetId);
            profileTagsMap = new Map(
              (profilePrefs ?? []).map((p) => [p.activityTagId, p.level]),
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
        meetupId: state.id,
        participantId: participant.id,
        userId: participant.userId,
        hasExplicitMeetupPreference: true,
        tags,
      };
    }

    // Fall back to profile preferences
    const profilePrefs = await this.fallbackPort.getProfilePreference(targetId);
    const profileMap = new Map(
      (profilePrefs ?? []).map((p) => [p.activityTagId, p.level]),
    );

    return {
      meetupId: state.id,
      participantId: participant.id,
      userId: participant.userId,
      hasExplicitMeetupPreference: false,
      tags: activeTags.map((tag) => ({
        activityTagId: tag.id,
        tagCode: tag.code,
        displayName: tag.displayName,
        level: profileMap.get(tag.id) ?? 'normal',
        source: 'profile_fallback',
        updatedAt: null,
      })),
    };
  }
}
