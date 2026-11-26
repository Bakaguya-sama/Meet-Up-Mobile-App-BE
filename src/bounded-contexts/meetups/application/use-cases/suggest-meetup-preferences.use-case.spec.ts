import { Meetup } from '../../domain/aggregates/meetup.aggregate';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';
import type {
  PreferenceDraftSession,
  PreferenceDraftStore,
} from '../ports/preference-draft-store.port';
import { SuggestMeetupPreferencesUseCase } from './suggest-meetup-preferences.use-case';
import { SetMeetupMemberPreferenceUseCase } from './set-meetup-member-preference.use-case';
import { PreferenceProviderError } from '../ports/preference-suggestion.port';

function fixture(enabled = true) {
  const meetup = Meetup.create(
    {
      id: 'meetup',
      organizerId: 'alice',
      organizerParticipantId: 'alice-part',
      invitees: [{ id: 'bob-part', userId: 'bob' }],
      title: 'Coffee',
      description: null,
      scheduledAt: new Date('2030-01-02'),
      invitationDeadlineAt: new Date('2030-01-01T12:00:00Z'),
      searchRadiusM: 1000,
      placeType: 'cafe',
      recommendationMode: 'balanced',
    },
    new Date('2030-01-01'),
  );
  meetup.setParticipantPreferences(
    'alice',
    [{ activityTagId: 1, level: 'high' }],
    250000,
    new Date('2030-01-01T01:00:00Z'),
  );
  const store = {
    insert: jest.fn(),
    updateLocked: jest.fn(
      async (
        _id: string,
        change: Parameters<MeetupStorePort['updateLocked']>[1],
      ) => {
        await change(meetup);
        return meetup.snapshot();
      },
    ),
    findVisible: jest.fn((_id: string, actor: string) =>
      Promise.resolve(
        actor === 'alice' || actor === 'bob' ? meetup.snapshot() : null,
      ),
    ),
    findById: jest.fn(),
    listVisible: jest.fn(),
    listFinishedHistory: jest.fn(),
    areAcceptedInActiveMeetup: jest.fn(),
    findAcceptedParticipantId: jest.fn(),
    getChatAccess: jest.fn(),
    listActiveChatRecipientIds: jest.fn(),
  } satisfies jest.Mocked<MeetupStorePort>;
  const data = new Map<string, PreferenceDraftSession>();
  const locks = new Set<string>();
  const sessions = {
    load: jest.fn((id: string) =>
      Promise.resolve(data.has(id) ? structuredClone(data.get(id)!) : null),
    ),
    save: jest.fn((s: PreferenceDraftSession) => {
      data.set(s.id, structuredClone(s));
      return Promise.resolve();
    }),
    acquire: jest.fn((id: string) => {
      if (locks.has(id)) return Promise.resolve(null);
      locks.add(id);
      return Promise.resolve('lease');
    }),
    release: jest.fn((id: string) => {
      locks.delete(id);
      return Promise.resolve();
    }),
    allowRequest: jest.fn(() => Promise.resolve(true)),
    consume: jest.fn(
      (id: string, actor: string, meeting: string, revision: number) => {
        const s = data.get(id);
        if (
          !s ||
          locks.has(id) ||
          s.actorId !== actor ||
          s.meetupId !== meeting ||
          s.revision !== revision ||
          s.mode !== 'proposal' ||
          s.expiresAt <= Date.now()
        )
          return Promise.resolve(null);
        const original = structuredClone(s);
        s.mode = 'consumed';
        return Promise.resolve(original);
      },
    ),
  } satisfies jest.Mocked<PreferenceDraftStore>;
  const fallback = {
    getActiveTags: jest.fn(() =>
      Promise.resolve([
        { id: 1, code: 'food', displayName: 'Ăn uống', isActive: true },
        { id: 2, code: 'coffee', displayName: 'Cà phê', isActive: true },
      ]),
    ),
    getProfilePreference: jest.fn(() => Promise.resolve([])),
  };
  const provider = {
    suggest: jest.fn((): Promise<unknown> =>
      Promise.resolve({
        preferences: [
          {
            activityTagId: 2,
            operation: 'set',
            level: 'normal',
            evidence: 'cà phê',
          },
        ],
        budget: { action: 'keep', amountVnd: null, evidence: '' },
        clarification: 'none',
        transcript: null,
      }),
    ),
  };
  const telemetry = {
    recordSuggestion: jest.fn(),
    recordConfirmation: jest.fn(),
  };
  const audio = {
    validate: jest.fn((input: { data: string; mimeType: string }) =>
      Promise.resolve(input),
    ),
  };
  return {
    meetup,
    store,
    data,
    locks,
    sessions,
    fallback,
    provider,
    telemetry,
    audio,
    suggest: new SuggestMeetupPreferencesUseCase(
      store,
      fallback,
      provider,
      telemetry,
      enabled,
      sessions,
      audio,
    ),
    confirm: new SetMeetupMemberPreferenceUseCase(
      store,
      fallback,
      telemetry,
      sessions,
    ),
  };
}

describe('AI preference draft lifecycle', () => {
  it('preserves untouched fields, emits an explicit confirmation payload and never saves from suggest', async () => {
    const f = fixture();
    const result = await f.suggest.execute('alice', 'meetup', {
      message: 'cà phê',
    });
    expect(result.mode).toBe('proposal');
    expect(result.preferences).toHaveLength(2);
    expect(result.budgetVnd).toBe(250000);
    expect(result.confirmation).not.toHaveProperty('budgetVnd');
    expect(f.store.updateLocked).not.toHaveBeenCalled();
    const serialized = JSON.stringify([...f.data.values()]);
    expect(serialized).not.toContain('cà phê');
    expect(serialized).not.toContain('transcript');
  });
  it('confirms exactly once and verifies provenance before logging AI usage', async () => {
    const f = fixture();
    const draft = await f.suggest.execute('alice', 'meetup', {
      message: 'cà phê',
    });
    const payload = draft.confirmation!;
    await f.confirm.execute(
      'alice',
      'meetup',
      payload.preferences,
      payload.budgetVnd,
      payload.aiSuggestionId,
      payload.aiSuggestionRevision,
    );
    expect(f.meetup.snapshot().participants[0].budgetVnd).toBe(250000);
    expect(f.telemetry.recordConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        usedAi: true,
        suggestionId: draft.suggestionId,
      }),
    );
    await expect(
      f.confirm.execute(
        'alice',
        'meetup',
        payload.preferences,
        undefined,
        payload.aiSuggestionId,
        payload.aiSuggestionRevision,
      ),
    ).rejects.toMatchObject({ code: 'PREFERENCE_DRAFT_CONFLICT' });
    expect(f.store.updateLocked).toHaveBeenCalledTimes(1);
  });
  it('refuses another actor, wrong revision and fake suggestion IDs without writing', async () => {
    const f = fixture();
    const draft = await f.suggest.execute('alice', 'meetup', {
      message: 'cà phê',
    });
    await expect(
      f.confirm.execute(
        'bob',
        'meetup',
        [],
        undefined,
        draft.suggestionId,
        draft.revision,
      ),
    ).rejects.toMatchObject({ code: 'PREFERENCE_DRAFT_CONFLICT' });
    await expect(
      f.confirm.execute(
        'alice',
        'meetup',
        [],
        undefined,
        draft.suggestionId,
        999,
      ),
    ).rejects.toMatchObject({ code: 'PREFERENCE_DRAFT_CONFLICT' });
    await expect(
      f.confirm.execute('alice', 'meetup', [], undefined, 'fake', 0),
    ).rejects.toMatchObject({ code: 'PREFERENCE_DRAFT_CONFLICT' });
    expect(f.store.updateLocked).not.toHaveBeenCalled();
  });
  it('rejects stale data inside the locked write', async () => {
    const f = fixture();
    const draft = await f.suggest.execute('alice', 'meetup', {
      message: 'cà phê',
    });
    f.meetup.setParticipantPreferences(
      'alice',
      [{ activityTagId: 1, level: 'avoid' }],
      900000,
      new Date(),
    );
    await expect(
      f.confirm.execute(
        'alice',
        'meetup',
        draft.preferences,
        undefined,
        draft.suggestionId,
        draft.revision,
      ),
    ).rejects.toMatchObject({ code: 'PREFERENCE_DRAFT_STALE' });
    expect(f.meetup.snapshot().participants[0].budgetVnd).toBe(900000);
  });
  it('rejects expired and busy sessions and old turns', async () => {
    const f = fixture();
    const draft = await f.suggest.execute('alice', 'meetup', {});
    f.locks.add(draft.suggestionId);
    await expect(
      f.suggest.execute('alice', 'meetup', {
        suggestionId: draft.suggestionId,
        revision: 0,
        message: 'cà phê',
      }),
    ).rejects.toMatchObject({ code: 'PREFERENCE_DRAFT_CONFLICT' });
    f.locks.clear();
    f.data.get(draft.suggestionId)!.expiresAt = 0;
    await expect(
      f.suggest.execute('alice', 'meetup', {
        suggestionId: draft.suggestionId,
        revision: 0,
      }),
    ).rejects.toMatchObject({ code: 'PREFERENCE_DRAFT_NOT_FOUND' });
  });
  it('caps clarifications and preserves current budget during an ambiguous budget conversation', async () => {
    const f = fixture();
    f.provider.suggest.mockResolvedValue({
      preferences: [],
      budget: { action: 'clarify', amountVnd: null, evidence: 'rẻ' },
      clarification: 'budget',
      transcript: null,
    });
    let draft = await f.suggest.execute('alice', 'meetup', { message: 'rẻ' });
    expect(draft.budgetVnd).toBe(250000);
    for (let i = 0; i < 2; i++)
      draft = await f.suggest.execute('alice', 'meetup', {
        suggestionId: draft.suggestionId,
        revision: draft.revision,
        message: 'rẻ',
      });
    expect(draft.mode).toBe('manual_fallback');
    expect(draft).not.toHaveProperty('confirmation');
    expect(f.provider.suggest).toHaveBeenCalledTimes(3);
  });
  it('supports skipping an optional budget without erasing the saved cap', async () => {
    const f = fixture();
    f.provider.suggest.mockResolvedValue({
      preferences: [
        {
          activityTagId: 2,
          operation: 'set',
          level: 'normal',
          evidence: 'cà phê',
        },
      ],
      budget: { action: 'clarify', amountVnd: null, evidence: 'rẻ' },
      clarification: 'budget',
      transcript: null,
    });
    const draft = await f.suggest.execute('alice', 'meetup', {
      message: 'cà phê rẻ',
    });
    const skipped = await f.suggest.execute('alice', 'meetup', {
      suggestionId: draft.suggestionId,
      revision: draft.revision,
      skipBudget: true,
    });
    expect(skipped.mode).toBe('proposal');
    expect(skipped.budgetVnd).toBe(250000);
    expect(skipped.confirmation).not.toHaveProperty('budgetVnd');
    expect(f.provider.suggest).toHaveBeenCalledTimes(1);
  });
  it.each([
    'disabled',
    'rate_limited',
    'timeout',
    'invalid_output',
    'session_unavailable',
  ])('falls back safely on %s', async (reason) => {
    const f = fixture(reason !== 'disabled');
    if (reason === 'rate_limited')
      jest.mocked(f.sessions.allowRequest).mockResolvedValue(false);
    if (reason === 'timeout')
      f.provider.suggest.mockRejectedValue(
        new PreferenceProviderError('timeout'),
      );
    if (reason === 'invalid_output')
      f.provider.suggest.mockResolvedValue({ preferences: [null] });
    if (reason === 'session_unavailable')
      jest
        .mocked(f.sessions.acquire)
        .mockRejectedValue(new Error('redis unavailable'));
    const result = await f.suggest.execute('alice', 'meetup', {
      message: 'cà phê',
    });
    expect(result.mode).toBe('manual_fallback');
    expect(result.fallbackReason).toBe(reason);
    expect(result).not.toHaveProperty('confirmation');
    expect(result.budgetVnd).toBe(250000);
    expect(f.store.updateLocked).not.toHaveBeenCalled();
  });
  it('keeps manual saves operational when Redis and telemetry fail', async () => {
    const f = fixture();
    jest.mocked(f.sessions.consume).mockRejectedValue(new Error('offline'));
    f.telemetry.recordConfirmation.mockImplementation(() => {
      throw new Error('logger');
    });
    await expect(
      f.confirm.execute('alice', 'meetup', [
        { activityTagId: 1, level: 'avoid' },
      ]),
    ).resolves.toHaveProperty('budgetVnd', 250000);
    expect(f.sessions.consume).not.toHaveBeenCalled();
  });
});
