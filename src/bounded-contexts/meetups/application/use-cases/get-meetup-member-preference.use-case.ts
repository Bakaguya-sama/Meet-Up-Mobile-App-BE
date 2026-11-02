import { MeetupError } from '../../domain/errors/meetup.error';
import type { MeetupMemberPreferenceResponseDto } from '../dto/meetup-response.dto';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';
import type { ProfilePreferenceFallbackPort } from '../ports/profile-preference-fallback.port';
import { resolveMeetupPreferences } from '../services/resolve-meetup-preferences';

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
    const state = await this.store.findVisible(meetupId, actorId.toLowerCase());
    if (!state) throw new MeetupError('MEETUP_NOT_FOUND', 'Meetup not found');
    const targetId = (targetUserId ?? actorId).toLowerCase();
    const participant = state.participants.find(
      (p) =>
        p.userId === targetId && ['invited', 'accepted'].includes(p.status),
    );
    if (!participant)
      throw new MeetupError(
        'MEETUP_NOT_FOUND',
        'Participant not found or no longer active in meetup',
      );
    const activeTags = await this.fallbackPort.getActiveTags();
    const resolved = await resolveMeetupPreferences(
      participant,
      activeTags,
      this.fallbackPort,
    );
    return {
      meetupId: state.id,
      participantId: participant.id,
      userId: participant.userId,
      ...resolved,
    };
  }
}
