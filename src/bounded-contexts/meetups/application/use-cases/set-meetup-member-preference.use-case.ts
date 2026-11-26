import { MeetupError } from '../../domain/errors/meetup.error';
import type { PreferenceTagInput } from '../dto/meetup-request.dto';
import type { MeetupMemberPreferenceResponseDto } from '../dto/meetup-response.dto';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';
import type { ProfilePreferenceFallbackPort } from '../ports/profile-preference-fallback.port';
import type { PreferenceSuggestionTelemetryPort } from '../ports/preference-suggestion-telemetry.port';
import { resolveMeetupPreferences } from '../services/resolve-meetup-preferences';
import type {
  PreferenceDraftSession,
  PreferenceDraftStore,
} from '../ports/preference-draft-store.port';
import {
  draftVersion,
  memberDraftVersion,
} from '../services/preference-draft-version';

export class SetMeetupMemberPreferenceUseCase {
  constructor(
    private readonly store: MeetupStorePort,
    private readonly fallbackPort: ProfilePreferenceFallbackPort,
    private readonly telemetry?: PreferenceSuggestionTelemetryPort,
    private readonly drafts?: PreferenceDraftStore,
  ) {}

  async execute(
    actorId: string,
    meetupId: string,
    preferences: PreferenceTagInput[],
    budgetVnd?: number | null,
    aiSuggestionId?: string,
    aiSuggestionRevision?: number,
  ): Promise<MeetupMemberPreferenceResponseDto> {
    actorId = actorId.toLowerCase();
    meetupId = meetupId.toLowerCase();
    if (
      (aiSuggestionId === undefined) !==
      (aiSuggestionRevision === undefined)
    ) {
      throw new MeetupError(
        'INVALID_INPUT',
        'Pair aiSuggestionId with aiSuggestionRevision',
      );
    }
    const activeTags = (await this.fallbackPort.getActiveTags()).sort(
      (a, b) => a.id - b.id,
    );
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
    let draft: PreferenceDraftSession | null = null;
    if (aiSuggestionId) {
      try {
        draft =
          (await this.drafts?.consume(
            aiSuggestionId,
            actorId,
            meetupId,
            aiSuggestionRevision!,
          )) ?? null;
      } catch {
        throw new MeetupError(
          'PREFERENCE_DRAFT_UNAVAILABLE',
          'Draft confirmation is temporarily unavailable; manual input is still available',
        );
      }
      if (!draft)
        throw new MeetupError(
          'PREFERENCE_DRAFT_CONFLICT',
          'Draft is expired, used, busy or belongs to another revision',
        );
    }
    const state = await this.store.updateLocked(meetupId, async (meetup) => {
      if (draft) {
        const current = meetup.snapshot();
        const member = current.participants.find((p) => p.userId === actorId);
        if (
          !member ||
          draft.baseVersion !== memberDraftVersion(current, actorId) ||
          draft.taxonomyVersion !== draftVersion(activeTags)
        ) {
          throw new MeetupError(
            'PREFERENCE_DRAFT_STALE',
            'Preferences or meetup changed; review a new draft',
          );
        }
        const effective = await resolveMeetupPreferences(
          member,
          activeTags,
          this.fallbackPort,
        );
        if (
          draft.profileVersion !==
          draftVersion(
            effective.tags
              .map(({ activityTagId, level }) => ({ activityTagId, level }))
              .sort((a, b) => a.activityTagId - b.activityTagId),
          )
        ) {
          throw new MeetupError(
            'PREFERENCE_DRAFT_STALE',
            'Profile preferences changed; review a new draft',
          );
        }
      }
      meetup.setParticipantPreferences(actorId, preferences, budgetVnd, now);
    });

    const participant = state.participants.find((p) => p.userId === actorId)!;
    try {
      this.telemetry?.recordConfirmation({
        ...(aiSuggestionId ? { suggestionId: aiSuggestionId } : {}),
        usedAi: draft !== null,
        finalTagIds: preferences.map((item) => item.activityTagId),
        ...(draft
          ? {
              durationMs: Date.now() - draft.createdAt,
              revision: draft.revision,
            }
          : {}),
      });
    } catch {
      /* Measurement must not turn a committed save into an error. */
    }
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
