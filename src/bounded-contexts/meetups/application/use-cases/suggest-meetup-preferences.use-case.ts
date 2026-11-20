import { randomUUID } from 'node:crypto';
import { MeetupError } from '../../domain/errors/meetup.error';
import type { PreferenceSuggestionTelemetryPort } from '../ports/preference-suggestion-telemetry.port';
import type { PreferenceSuggestionProvider } from '../ports/preference-suggestion.port';
import type { ProfilePreferenceFallbackPort } from '../ports/profile-preference-fallback.port';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';

export class SuggestMeetupPreferencesUseCase {
  constructor(
    private readonly store: MeetupStorePort,
    private readonly fallback: ProfilePreferenceFallbackPort,
    private readonly provider: PreferenceSuggestionProvider,
    private readonly telemetry: PreferenceSuggestionTelemetryPort,
    private readonly enabled: boolean,
  ) {}

  async execute(
    actorId: string,
    meetupId: string,
    input: {
      message?: string;
      conversation?: Array<{ role: 'user' | 'assistant'; text: string }>;
      audio?: { data: string; mimeType: string };
    },
  ) {
    const meetup = await this.store.findVisible(
      meetupId,
      actorId.toLowerCase(),
    );
    const participant = meetup?.participants.find(
      (item) => item.userId === actorId.toLowerCase(),
    );
    if (!meetup || !participant) {
      throw new MeetupError('MEETUP_NOT_FOUND', 'Meetup not found');
    }
    if (
      !['inviting', 'choosing'].includes(meetup.status) ||
      !['invited', 'accepted'].includes(participant.status)
    ) {
      throw new MeetupError(
        'MEETUP_NOT_EDITABLE',
        'Meetup preferences are closed',
      );
    }

    const startedAt = Date.now();
    const suggestionId = randomUUID();
    const activeTags = await this.fallback.getActiveTags();
    if (
      !input.message &&
      !input.audio &&
      !input.conversation?.some((turn) => turn.role === 'user')
    ) {
      const result = {
        mode: 'clarification' as const,
        replyText:
          'Bạn muốn đi chơi theo kiểu nào? Ví dụ: ăn uống, cà phê, hoạt động ngoài trời hoặc giải trí.',
        readyToConfirm: false,
        preferences: [],
        budgetVnd: null,
        saved: false,
      };
      this.telemetry.recordSuggestion({
        suggestionId,
        usedAi: false,
        outcome: 'clarification',
        suggestedTagIds: [],
        durationMs: Date.now() - startedAt,
      });
      return result;
    }
    if (!this.enabled) {
      this.telemetry.recordSuggestion({
        suggestionId,
        usedAi: false,
        outcome: 'manual_fallback',
        suggestedTagIds: [],
        durationMs: Date.now() - startedAt,
      });
      return manualFallback(activeTags);
    }
    try {
      const suggestion = await this.provider.suggest({
        ...input,
        tags: activeTags.map(({ id, code, displayName }) => ({
          id,
          code,
          displayName,
        })),
      });
      const activeIds = new Set(activeTags.map((tag) => tag.id));
      const preferences = suggestion.preferences.filter(
        (item) =>
          activeIds.has(item.activityTagId) &&
          ['high', 'normal', 'avoid'].includes(item.level),
      );
      const budgetVnd = suggestion.budgetVnd;
      if (
        budgetVnd !== null &&
        (!Number.isSafeInteger(budgetVnd) ||
          budgetVnd < 0 ||
          budgetVnd > 2_147_483_647)
      ) {
        this.telemetry.recordSuggestion({
          suggestionId,
          usedAi: true,
          outcome: 'manual_fallback',
          suggestedTagIds: [],
          durationMs: Date.now() - startedAt,
        });
        return { ...manualFallback(activeTags), suggestionId };
      }
      const uniquePreferences = [
        ...new Map(
          preferences.map((item) => [item.activityTagId, item]),
        ).values(),
      ];
      const result = {
        suggestionId,
        mode: suggestion.status,
        replyText: suggestion.replyText.slice(0, 500),
        readyToConfirm: suggestion.status === 'proposal',
        preferences: uniquePreferences,
        budgetVnd,
        // AI drafts are transient. The client must submit the user's confirmed values to PUT.
        saved: false,
      };
      this.telemetry.recordSuggestion({
        suggestionId,
        usedAi: true,
        outcome: suggestion.status,
        suggestedTagIds: uniquePreferences.map((item) => item.activityTagId),
        durationMs: Date.now() - startedAt,
      });
      return result;
    } catch {
      this.telemetry.recordSuggestion({
        suggestionId,
        usedAi: true,
        outcome: 'manual_fallback',
        suggestedTagIds: [],
        durationMs: Date.now() - startedAt,
      });
      return { ...manualFallback(activeTags), suggestionId };
    }
  }
}

function manualFallback(
  tags: Array<{ id: number; code: string; displayName: string }>,
) {
  return {
    mode: 'manual_fallback' as const,
    replyText:
      'AI đang tạm thời không khả dụng. Bạn có thể chọn sở thích và ngân sách thủ công.',
    readyToConfirm: false,
    preferences: [],
    budgetVnd: null,
    saved: false,
    availableTags: tags.map(({ id, code, displayName }) => ({
      activityTagId: id,
      tagCode: code,
      displayName,
    })),
  };
}
