import { MeetupError } from '../../domain/errors/meetup.error';
import type { MeetupPreferencesSummaryResponseDto } from '../dto/meetup-response.dto';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';
import type { ProfilePreferenceFallbackPort } from '../ports/profile-preference-fallback.port';
import { resolveMeetupPreferences } from '../services/resolve-meetup-preferences';

export class GetMeetupPreferencesSummaryQuery {
  constructor(
    private readonly store: MeetupStorePort,
    private readonly fallbackPort: ProfilePreferenceFallbackPort,
  ) {}
  async execute(
    actorId: string,
    meetupId: string,
  ): Promise<MeetupPreferencesSummaryResponseDto> {
    const state = await this.store.findVisible(meetupId, actorId.toLowerCase());
    if (!state) throw new MeetupError('MEETUP_NOT_FOUND', 'Meetup not found');
    const activeTags = await this.fallbackPort.getActiveTags();
    const activeParticipants = state.participants.filter((p) =>
      ['invited', 'accepted'].includes(p.status),
    );
    const participants = await Promise.all(
      activeParticipants.map(async (p) => {
        const resolved = await resolveMeetupPreferences(
          p,
          activeTags,
          this.fallbackPort,
        );
        return {
          participantId: p.id,
          userId: p.userId,
          status: p.status,
          source: resolved.hasExplicitMeetupPreference
            ? ('meetup_input' as const)
            : ('profile_fallback' as const),
          ...resolved,
        };
      }),
    );
    const submittedCount = participants.filter(
      (p) => p.hasExplicitMeetupPreference,
    ).length;
    return {
      meetupId: state.id,
      totalParticipants: participants.length,
      submittedCount,
      fallbackCount: participants.length - submittedCount,
      participants,
    };
  }
}
