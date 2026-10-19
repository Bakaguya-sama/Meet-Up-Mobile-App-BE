import { SetMeetupMemberPreferenceUseCase } from './set-meetup-member-preference.use-case';
import { GetMeetupMemberPreferenceUseCase } from './get-meetup-member-preference.use-case';
import { GetMeetupPreferencesSummaryQuery } from '../queries/get-meetup-preferences-summary.query';
import {
  Meetup,
  type MeetupDetails,
} from '../../domain/aggregates/meetup.aggregate';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';
import type {
  ActivityTagItem,
  ProfilePreferenceFallbackPort,
  ProfilePreferenceTag,
} from '../ports/profile-preference-fallback.port';

describe('Meetup Preferences Use Cases and Queries (BE-02, BE-08, S3, Core)', () => {
  const now = new Date('2030-01-01T10:00:00Z');
  const details: MeetupDetails = {
    title: 'Weekend Meetup',
    description: null,
    scheduledAt: new Date('2030-01-01T12:00:00Z'),
    invitationDeadlineAt: new Date('2030-01-01T11:00:00Z'),
    searchRadiusM: 5000,
    placeType: 'cafe',
    recommendationMode: 'balanced',
  };

  const activeTags: ActivityTagItem[] = [
    { id: 1, code: 'food', displayName: 'Ăn uống', isActive: true },
    { id: 2, code: 'coffee', displayName: 'Cà phê', isActive: true },
    { id: 3, code: 'movie', displayName: 'Xem phim', isActive: true },
    { id: 4, code: 'mall', displayName: 'Mua sắm', isActive: true },
  ];

  let meetup: Meetup;
  let updateLockedFn: jest.Mock;
  let findVisibleFn: jest.Mock;
  let mockStore: MeetupStorePort;
  let mockFallback: ProfilePreferenceFallbackPort;

  beforeEach(() => {
    meetup = Meetup.create(
      {
        ...details,
        id: 'meetup-1',
        organizerId: 'alice',
        organizerParticipantId: 'part-alice',
        invitees: [
          { id: 'part-bob', userId: 'bob' },
          { id: 'part-carol', userId: 'carol' },
        ],
      },
      now,
    );
    // Bob accepts invitation
    meetup.respond('bob', 'accepted', now);

    updateLockedFn = jest.fn(
      (_id: string, change: (m: Meetup) => void | Promise<void>) => {
        const res = change(meetup);
        if (res instanceof Promise) {
          return res.then(() => meetup.snapshot());
        }
        return Promise.resolve(meetup.snapshot());
      },
    );

    findVisibleFn = jest.fn((_id: string, actorId: string) => {
      try {
        meetup.assertVisible(actorId);
        return Promise.resolve(meetup.snapshot());
      } catch {
        return Promise.resolve(null);
      }
    });

    mockStore = {
      insert: jest.fn(() => Promise.resolve()),
      updateLocked: updateLockedFn,
      findVisible: findVisibleFn,
      findById: jest.fn((id: string) =>
        Promise.resolve(id === 'meetup-1' ? meetup.snapshot() : null),
      ),
      listVisible: jest.fn(() => Promise.resolve({ items: [], total: 0 })),
      areAcceptedInActiveMeetup: jest.fn(() => Promise.resolve(true)),
    };

    mockFallback = {
      getActiveTags: jest.fn(() => Promise.resolve(activeTags)),
      getProfilePreference: jest.fn((userId: string) => {
        if (userId === 'alice') {
          return Promise.resolve([
            {
              activityTagId: 1,
              tagCode: 'food',
              displayName: 'Ăn uống',
              level: 'normal',
            },
            {
              activityTagId: 2,
              tagCode: 'coffee',
              displayName: 'Cà phê',
              level: 'high',
            },
          ] as ProfilePreferenceTag[]);
        }
        if (userId === 'bob') {
          return Promise.resolve([
            {
              activityTagId: 2,
              tagCode: 'coffee',
              displayName: 'Cà phê',
              level: 'avoid',
            },
          ] as ProfilePreferenceTag[]);
        }
        return Promise.resolve(null);
      }),
    };
  });

  describe('SetMeetupMemberPreferenceUseCase', () => {
    it('sets temporary preferences with source=meetup_input and active tag metadata', async () => {
      const useCase = new SetMeetupMemberPreferenceUseCase(
        mockStore,
        mockFallback,
      );

      const result = await useCase.execute('alice', 'meetup-1', [
        { activityTagId: 1, level: 'high' },
        { activityTagId: 2, level: 'avoid' },
      ]);

      expect(result).toMatchObject({
        meetupId: 'meetup-1',
        participantId: 'part-alice',
        userId: 'alice',
        hasExplicitMeetupPreference: true,
      });

      const foodTag = result.tags.find((t) => t.activityTagId === 1)!;
      expect(foodTag).toMatchObject({
        activityTagId: 1,
        tagCode: 'food',
        displayName: 'Ăn uống',
        level: 'high',
        source: 'meetup_input',
      });
      expect(foodTag.updatedAt).toBeTruthy();

      const coffeeTag = result.tags.find((t) => t.activityTagId === 2)!;
      expect(coffeeTag).toMatchObject({
        activityTagId: 2,
        tagCode: 'coffee',
        displayName: 'Cà phê',
        level: 'avoid',
        source: 'meetup_input',
      });

      expect(updateLockedFn).toHaveBeenCalledWith(
        'meetup-1',
        expect.any(Function),
      );
    });

    it('rejects if an activity tag is not in active tags', async () => {
      const useCase = new SetMeetupMemberPreferenceUseCase(
        mockStore,
        mockFallback,
      );

      await expect(
        useCase.execute('alice', 'meetup-1', [
          { activityTagId: 999, level: 'high' },
        ]),
      ).rejects.toThrow('Activity tag ID 999 does not exist or is inactive');
    });
  });

  describe('GetMeetupMemberPreferenceUseCase (BR-21 preference fallback)', () => {
    it('returns profile_fallback when member has not set meetup preferences', async () => {
      const useCase = new GetMeetupMemberPreferenceUseCase(
        mockStore,
        mockFallback,
      );

      const result = await useCase.execute('alice', 'meetup-1');

      expect(result).toMatchObject({
        meetupId: 'meetup-1',
        participantId: 'part-alice',
        userId: 'alice',
        hasExplicitMeetupPreference: false,
      });

      const coffee = result.tags.find((t) => t.activityTagId === 2)!;
      expect(coffee).toMatchObject({
        activityTagId: 2,
        tagCode: 'coffee',
        level: 'high',
        source: 'profile_fallback',
        updatedAt: null,
      });

      const movie = result.tags.find((t) => t.activityTagId === 3)!;
      expect(movie).toMatchObject({
        activityTagId: 3,
        tagCode: 'movie',
        level: 'normal',
        source: 'profile_fallback',
        updatedAt: null,
      });
    });

    it('BR-21: Prioritises temporary meetup preference over profile preference', async () => {
      const setUseCase = new SetMeetupMemberPreferenceUseCase(
        mockStore,
        mockFallback,
      );
      const getUseCase = new GetMeetupMemberPreferenceUseCase(
        mockStore,
        mockFallback,
      );

      await setUseCase.execute('alice', 'meetup-1', [
        { activityTagId: 2, level: 'avoid' },
      ]);

      const result = await getUseCase.execute('alice', 'meetup-1');

      expect(result.hasExplicitMeetupPreference).toBe(true);

      const coffee = result.tags.find((t) => t.activityTagId === 2)!;
      expect(coffee.level).toBe('avoid');
      expect(coffee.source).toBe('meetup_input');

      const food = result.tags.find((t) => t.activityTagId === 1)!;
      expect(food.level).toBe('normal');
      expect(food.source).toBe('profile_fallback');
    });

    it('throws error when meetup is not found or not visible to user', async () => {
      const getUseCase = new GetMeetupMemberPreferenceUseCase(
        mockStore,
        mockFallback,
      );

      await expect(getUseCase.execute('stranger', 'meetup-1')).rejects.toThrow(
        'Meetup not found',
      );
    });
  });

  describe('GetMeetupPreferencesSummaryQuery (Pre-check before recommendation)', () => {
    it('returns participants preference summary with submittedCount and fallbackCount', async () => {
      const setUseCase = new SetMeetupMemberPreferenceUseCase(
        mockStore,
        mockFallback,
      );
      const summaryQuery = new GetMeetupPreferencesSummaryQuery(
        mockStore,
        mockFallback,
      );

      await setUseCase.execute('alice', 'meetup-1', [
        { activityTagId: 1, level: 'high' },
      ]);

      const summary = await summaryQuery.execute('alice', 'meetup-1');

      expect(summary.totalParticipants).toBe(3);
      expect(summary.submittedCount).toBe(1);
      expect(summary.fallbackCount).toBe(2);

      const aliceSummary = summary.participants.find(
        (p) => p.userId === 'alice',
      )!;
      expect(aliceSummary.hasExplicitMeetupPreference).toBe(true);
      expect(aliceSummary.source).toBe('meetup_input');

      const bobSummary = summary.participants.find((p) => p.userId === 'bob')!;
      expect(bobSummary.hasExplicitMeetupPreference).toBe(false);
      expect(bobSummary.source).toBe('profile_fallback');
      const bobCoffee = bobSummary.tags.find((t) => t.activityTagId === 2)!;
      expect(bobCoffee.level).toBe('avoid');
    });
  });
});
