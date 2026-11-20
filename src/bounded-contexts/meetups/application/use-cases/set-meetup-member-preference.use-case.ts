import { MeetupError } from '../../domain/errors/meetup.error';
import type { PreferenceTagInput } from '../dto/meetup-request.dto';
import type { MeetupMemberPreferenceResponseDto } from '../dto/meetup-response.dto';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';
import type { ProfilePreferenceFallbackPort } from '../ports/profile-preference-fallback.port';
import type { PreferenceSuggestionTelemetryPort } from '../ports/preference-suggestion-telemetry.port';
import { resolveMeetupPreferences } from '../services/resolve-meetup-preferences';

export class SetMeetupMemberPreferenceUseCase {
  constructor(
    private readonly store: MeetupStorePort,
    private readonly fallbackPort: ProfilePreferenceFallbackPort,
    private readonly telemetry?: PreferenceSuggestionTelemetryPort,
  ) {}

  async execute(
    actorId: string,
    meetupId: string,
    preferences: PreferenceTagInput[],
    budgetVnd?: number | null,
    aiSuggestionId?: string,
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

    // Resolve fallback before committing a clear, so a profile read failure cannot
    // turn an already-committed change into a failed HTTP response.
    const clearedFallback =
      preferences.length === 0
        ? await this.fallbackPort.getProfilePreference(actorId)
        : null;
    const now = new Date();
    const state = await this.store.updateLocked(meetupId, (meetup) => {
      meetup.setParticipantPreferences(actorId, preferences, budgetVnd, now);
    });

    const participant = state.participants.find((p) => p.userId === actorId)!;
    this.telemetry?.recordConfirmation({
      ...(aiSuggestionId ? { suggestionId: aiSuggestionId } : {}),
      usedAi: Boolean(aiSuggestionId),
      finalTagIds: preferences.map((item) => item.activityTagId),
    });
    const resolved = await resolveMeetupPreferences(
      participant,
      activeTags,
      preferences.length === 0
        ? {
            getActiveTags: () => Promise.resolve(activeTags),
            getProfilePreference: () => Promise.resolve(clearedFallback),
          }
        : this.fallbackPort,
    );

    return {
      meetupId: state.id,
      participantId: participant.id,
      userId: participant.userId,
      budgetVnd: participant.budgetVnd ?? null,
      ...resolved,
    };
  }
}
