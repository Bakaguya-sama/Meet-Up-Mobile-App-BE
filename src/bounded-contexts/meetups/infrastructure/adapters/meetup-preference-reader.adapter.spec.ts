import { TypeOrmMeetupPreferenceReader } from './meetup-preference-reader.adapter';
import {
  Meetup,
  type MeetupDetails,
} from '../../domain/aggregates/meetup.aggregate';
import type { MeetupStorePort } from '../../application/ports/persistence/meetup-store.port';
import type {
  ActivityTagItem,
  ProfilePreferenceFallbackPort,
  ProfilePreferenceTag,
} from '../../application/ports/profile-preference-fallback.port';

describe('TypeOrmMeetupPreferenceReader (Infrastructure Adapter)', () => {
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
  ];

  it('returns effective preferences for accepted participants enforcing BR-21', async () => {
    const meetup = Meetup.create(
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
    meetup.respond('bob', 'accepted', now);

    meetup.setParticipantPreferences(
      'alice',
      [
        { activityTagId: 1, level: 'high' },
        { activityTagId: 2, level: 'avoid' },
      ],
      now,
    );

    const mockStore: MeetupStorePort = {
      insert: jest.fn(() => Promise.resolve()),
      updateLocked: jest.fn(() => Promise.resolve(meetup.snapshot())),
      findVisible: jest.fn(() => Promise.resolve(meetup.snapshot())),
      findById: jest.fn((id: string) =>
        Promise.resolve(id === 'meetup-1' ? meetup.snapshot() : null),
      ),
      listVisible: jest.fn(() => Promise.resolve({ items: [], total: 0 })),
      areAcceptedInActiveMeetup: jest.fn(() => Promise.resolve(true)),
    };

    const mockFallback: ProfilePreferenceFallbackPort = {
      getActiveTags: jest.fn(() => Promise.resolve(activeTags)),
      getProfilePreference: jest.fn((userId: string) => {
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

    const reader = new TypeOrmMeetupPreferenceReader(mockStore, mockFallback);
    const effective = await reader.getEffectivePreferences('meetup-1');

    expect(effective).toHaveLength(2); // alice & bob (carol is not accepted)
    const alicePref = effective.find((p) => p.userId === 'alice')!;
    expect(alicePref.hasExplicitMeetupPreference).toBe(true);
    expect(alicePref.tags.find((t) => t.activityTagId === 1)!.level).toBe(
      'high',
    );
    expect(alicePref.tags.find((t) => t.activityTagId === 2)!.level).toBe(
      'avoid',
    );
    expect(alicePref.tags.find((t) => t.activityTagId === 2)!.source).toBe(
      'meetup_input',
    );

    const bobPref = effective.find((p) => p.userId === 'bob')!;
    expect(bobPref.hasExplicitMeetupPreference).toBe(false);
    expect(bobPref.tags.find((t) => t.activityTagId === 2)!.level).toBe(
      'avoid',
    );
    expect(bobPref.tags.find((t) => t.activityTagId === 2)!.source).toBe(
      'profile_fallback',
    );
  });
});
