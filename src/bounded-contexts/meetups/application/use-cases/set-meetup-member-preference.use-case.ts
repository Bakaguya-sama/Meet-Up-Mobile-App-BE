import { MeetupError } from '../../domain/errors/meetup.error';
import type { PreferenceTagInput } from '../dto/meetup-request.dto';
import type { MeetupMemberPreferenceResponseDto } from '../dto/meetup-response.dto';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';
import type { ProfilePreferenceFallbackPort } from '../ports/profile-preference-fallback.port';

export class SetMeetupMemberPreferenceUseCase {
  constructor(
    private readonly store: MeetupStorePort,
    private readonly fallbackPort: ProfilePreferenceFallbackPort,
  ) {}

  async execute(
    actorId: string,
    meetupId: string,
    preferences: PreferenceTagInput[],
  ): Promise<MeetupMemberPreferenceResponseDto> {
    actorId = actorId.toLowerCase();
    const activeTags = await this.fallbackPort.getActiveTags();
    const activeTagMap = new Map(activeTags.map((t) => [t.id, t]));

    for (const item of preferences) {
      if (!activeTagMap.has(item.activityTagId)) {
        throw new MeetupError(
          'INVALID_INPUT',
          `Activity tag ID ${item.activityTagId} does not exist or is inactive`,
        );
      }
    }

    const now = new Date();
    const state = await this.store.updateLocked(meetupId, (meetup) => {
      meetup.setParticipantPreferences(actorId, preferences, now);
    });

    const participant = state.participants.find((p) => p.userId === actorId)!;
    const prefMap = new Map(
      (participant.preferences ?? []).map((p) => [p.activityTagId, p]),
    );

    return {
      meetupId: state.id,
      participantId: participant.id,
      userId: participant.userId,
      hasExplicitMeetupPreference: true,
      tags: activeTags.map((tag) => {
        const saved = prefMap.get(tag.id);
        return {
          activityTagId: tag.id,
          tagCode: tag.code,
          displayName: tag.displayName,
          level: saved ? saved.level : 'normal',
          source: saved ? saved.source : 'profile_fallback',
          updatedAt: saved ? saved.updatedAt.toISOString() : null,
        };
      }),
    };
  }
}
