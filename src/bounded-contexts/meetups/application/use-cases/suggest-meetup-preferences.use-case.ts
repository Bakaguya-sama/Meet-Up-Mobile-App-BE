import { randomUUID } from 'node:crypto';
import { MeetupError } from '../../domain/errors/meetup.error';
import {
  applyPreferenceExtraction,
  InvalidPreferenceExtraction,
  PREFERENCE_QUESTIONS,
  validatePreferenceExtraction,
} from '../../domain/services/preference-draft';
import type { PreferenceSuggestionTelemetryPort } from '../ports/preference-suggestion-telemetry.port';
import {
  PreferenceProviderError,
  type PreferenceSuggestionProvider,
} from '../ports/preference-suggestion.port';
import type {
  PreferenceDraftSession,
  PreferenceDraftStore,
} from '../ports/preference-draft-store.port';
import type { PreferenceAudioPort } from '../ports/preference-audio.port';
import type { ProfilePreferenceFallbackPort } from '../ports/profile-preference-fallback.port';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';
import {
  draftVersion,
  memberDraftVersion,
} from '../services/preference-draft-version';
import { resolveMeetupPreferences } from '../services/resolve-meetup-preferences';

export interface SuggestPreferencesInput {
  suggestionId?: string;
  revision?: number;
  skipBudget?: boolean;
  message?: string;
  audio?: { data: string; mimeType: string };
}
export class SuggestMeetupPreferencesUseCase {
  constructor(
    private readonly store: MeetupStorePort,
    private readonly fallback: ProfilePreferenceFallbackPort,
    private readonly provider: PreferenceSuggestionProvider,
    private readonly telemetry: PreferenceSuggestionTelemetryPort,
    private readonly enabled: boolean,
    private readonly sessions: PreferenceDraftStore,
    private readonly audio: PreferenceAudioPort,
    private readonly ttlSeconds = 900,
  ) {}

  async execute(
    actorId: string,
    meetupId: string,
    input: SuggestPreferencesInput,
  ) {
    actorId = actorId.toLowerCase();
    meetupId = meetupId.toLowerCase();
    const message = input.message?.trim() || undefined;
    if (
      (input.suggestionId === undefined) !== (input.revision === undefined) ||
      (message && input.audio) ||
      (input.skipBudget && (message || input.audio || !input.suggestionId))
    ) {
      throw new MeetupError(
        'INVALID_INPUT',
        'Send text or audio and pair suggestionId with revision',
      );
    }
    const meetup = await this.store.findVisible(meetupId, actorId);
    const participant = meetup?.participants.find((p) => p.userId === actorId);
    if (!meetup || !participant)
      throw new MeetupError('MEETUP_NOT_FOUND', 'Meetup not found');
    if (
      !['inviting', 'choosing'].includes(meetup.status) ||
      !['invited', 'accepted'].includes(participant.status)
    ) {
      throw new MeetupError(
        'MEETUP_NOT_EDITABLE',
        'Meetup preferences are closed',
      );
    }
    const activeTags = (await this.fallback.getActiveTags()).sort(
      (a, b) => a.id - b.id,
    );
    const resolved = await resolveMeetupPreferences(
      participant,
      activeTags,
      this.fallback,
    );
    const effective = resolved.tags
      .map(({ activityTagId, level }) => ({ activityTagId, level }))
      .sort((a, b) => a.activityTagId - b.activityTagId);
    const startedAt = Date.now();
    let session: PreferenceDraftSession = {
      id: input.suggestionId ?? randomUUID(),
      actorId,
      meetupId,
      createdAt: startedAt,
      expiresAt: startedAt + this.ttlSeconds * 1000,
      revision: 0,
      turns: 0,
      clarifications: 0,
      baseVersion: memberDraftVersion(meetup, actorId),
      profileVersion: draftVersion(effective),
      taxonomyVersion: draftVersion(activeTags),
      mode: 'clarification',
      draft: {
        preferences: (participant.preferences ?? []).map(
          ({ activityTagId, level }) => ({ activityTagId, level }),
        ),
        effectivePreferences: effective,
        budgetVnd: participant.budgetVnd ?? null,
        budgetAction: 'keep',
        pendingBudgetQuestion: 'none',
        hasChanges: false,
        question: 'activity',
      },
    };
    const render = (
      mode: 'clarification' | 'proposal' | 'manual_fallback',
      reason?: string,
      transcript?: string | null,
    ) => {
      const ready = mode === 'proposal';
      return {
        schemaVersion: 2 as const,
        suggestionId: session.id,
        revision: session.revision,
        expiresAt: new Date(session.expiresAt).toISOString(),
        mode,
        readyToConfirm: ready,
        saved: false as const,
        replyText:
          mode === 'manual_fallback'
            ? 'Bạn có thể tiếp tục bằng cách chọn sở thích và ngân sách thủ công.'
            : session.draft.question === 'activity' && activeTags.length
              ? 'Bạn muốn chọn hoạt động nào? Ví dụ: ' +
                activeTags
                  .slice(0, 4)
                  .map((t) => t.displayName)
                  .join(', ') +
                '.'
              : PREFERENCE_QUESTIONS[session.draft.question],
        preferences: session.draft.preferences,
        effectivePreferences: session.draft.effectivePreferences,
        budgetVnd: session.draft.budgetVnd,
        budgetAction: session.draft.budgetAction,
        clarification: session.draft.question,
        ...(reason ? { fallbackReason: reason } : {}),
        ...(transcript ? { transcript } : {}),
        availableTags: activeTags.map(({ id, code, displayName }) => ({
          activityTagId: id,
          tagCode: code,
          displayName,
        })),
        ...(ready
          ? {
              confirmation: {
                preferences: session.draft.preferences,
                ...(session.draft.budgetAction !== 'keep'
                  ? { budgetVnd: session.draft.budgetVnd }
                  : {}),
                aiSuggestionId: session.id,
                aiSuggestionRevision: session.revision,
              },
            }
          : {}),
      };
    };
    let usedAi = false;
    const record = (
      outcome: 'proposal' | 'clarification' | 'manual_fallback',
      reason?: string,
    ) => {
      // Telemetry must never break manual input or turn an already-produced draft into an error.
      try {
        this.telemetry.recordSuggestion({
          suggestionId: session.id,
          usedAi,
          outcome,
          suggestedTagIds: session.draft.effectivePreferences.map(
            (p) => p.activityTagId,
          ),
          durationMs: Date.now() - startedAt,
          revision: session.revision,
          reason,
          promptVersion: 'v2',
        });
      } catch {
        /* best-effort measurement only */
      }
    };
    if (!this.enabled) {
      record('manual_fallback', 'disabled');
      return render('manual_fallback', 'disabled');
    }
    let lease: string | null = null;
    try {
      lease = await this.sessions.acquire(session.id);
      if (!lease)
        throw new MeetupError(
          'PREFERENCE_DRAFT_CONFLICT',
          'Draft is being processed; retry after the current request',
        );
      if (input.suggestionId) {
        const loaded = await this.sessions.load(session.id);
        if (
          !loaded ||
          loaded.actorId !== actorId ||
          loaded.meetupId !== meetupId ||
          loaded.expiresAt <= Date.now()
        ) {
          throw new MeetupError(
            'PREFERENCE_DRAFT_NOT_FOUND',
            'Draft is unavailable; start a new draft',
          );
        }
        if (
          loaded.revision !== input.revision ||
          loaded.mode === 'consumed' ||
          loaded.mode === 'manual_fallback'
        ) {
          throw new MeetupError(
            'PREFERENCE_DRAFT_CONFLICT',
            'Draft revision is no longer available',
          );
        }
        if (
          loaded.baseVersion !== session.baseVersion ||
          loaded.profileVersion !== session.profileVersion ||
          loaded.taxonomyVersion !== session.taxonomyVersion
        ) {
          throw new MeetupError(
            'PREFERENCE_DRAFT_STALE',
            'Preferences or meetup changed; start a new draft',
          );
        }
        session = loaded;
      }
      if (session.turns >= 5 || session.clarifications >= 3) {
        session.mode = 'manual_fallback';
        session.revision++;
        await this.sessions.save(session, lease);
        record('manual_fallback', 'turn_limit');
        return render('manual_fallback', 'turn_limit');
      }
      if (input.skipBudget) {
        session.revision++;
        session.draft.budgetVnd = participant.budgetVnd ?? null;
        session.draft.budgetAction = 'keep';
        session.draft.pendingBudgetQuestion = 'none';
        session.draft.hasChanges =
          draftVersion(session.draft.preferences) !==
          draftVersion(
            (participant.preferences ?? []).map(({ activityTagId, level }) => ({
              activityTagId,
              level,
            })),
          );
        session.draft.question = session.draft.hasChanges ? 'none' : 'activity';
        session.mode = session.draft.hasChanges ? 'proposal' : 'clarification';
        await this.sessions.save(session, lease);
        record(session.mode);
        return render(session.mode);
      }
      if (!message && !input.audio) {
        await this.sessions.save(session, lease);
        record(session.mode === 'proposal' ? 'proposal' : 'clarification');
        return render(
          session.mode === 'proposal' ? 'proposal' : 'clarification',
        );
      }
      const audio = input.audio
        ? await this.audio.validate(input.audio)
        : undefined;
      if (!(await this.sessions.allowRequest(actorId))) {
        session.mode = 'manual_fallback';
        session.revision++;
        await this.sessions.save(session, lease);
        record('manual_fallback', 'rate_limited');
        return render('manual_fallback', 'rate_limited');
      }
      // Reserve the turn before calling the provider; failures also consume a turn.
      session.turns++;
      session.revision++;
      session.mode = 'clarification';
      await this.sessions.save(session, lease);
      usedAi = true;
      const raw = await this.provider.suggest({
        message,
        audio,
        state: session.draft,
        tags: activeTags.map(({ id, code, displayName }) => ({
          id,
          code,
          displayName,
        })),
      });
      const extraction = validatePreferenceExtraction(
        raw,
        new Set(activeTags.map((t) => t.id)),
        message,
      );
      session.draft = applyPreferenceExtraction(session.draft, extraction);
      session.mode =
        session.draft.question === 'none' && session.draft.hasChanges
          ? 'proposal'
          : 'clarification';
      if (session.draft.question === 'unsupported')
        session.mode = 'manual_fallback';
      if (session.mode === 'clarification') session.clarifications++;
      if (session.mode === 'clarification' && session.clarifications >= 3)
        session.mode = 'manual_fallback';
      await this.sessions.save(session, lease);
      const reason =
        session.mode === 'manual_fallback'
          ? session.draft.question === 'unsupported'
            ? 'unsupported_constraint'
            : 'turn_limit'
          : undefined;
      record(session.mode, reason);
      return render(session.mode, reason, extraction.transcript);
    } catch (error) {
      if (error instanceof MeetupError) throw error;
      const reason =
        error instanceof PreferenceProviderError
          ? error.reason
          : error instanceof InvalidPreferenceExtraction
            ? 'invalid_output'
            : 'session_unavailable';
      session.mode = 'manual_fallback';
      if (lease) {
        try {
          await this.sessions.save(session, lease);
        } catch {
          /* fail closed: no confirmation payload */
        }
      }
      record('manual_fallback', reason);
      return render('manual_fallback', reason);
    } finally {
      if (lease) {
        try {
          await this.sessions.release(session.id, lease);
        } catch {
          /* lease has a bounded TTL */
        }
      }
    }
  }
}
