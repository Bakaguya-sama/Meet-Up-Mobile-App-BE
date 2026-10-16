import type { MeetupErrorCode } from '../errors/meetup.error';
import {
  Meetup,
  type MeetupDetails,
  type MeetupStatus,
} from './meetup.aggregate';

const now = new Date('2030-01-01T10:00:00Z');
const details: MeetupDetails = {
  title: 'Coffee',
  description: null,
  scheduledAt: new Date('2030-01-01T12:00:00Z'),
  invitationDeadlineAt: new Date('2030-01-01T11:00:00Z'),
  searchRadiusM: 5000,
  placeType: 'cafe',
  recommendationMode: 'balanced',
};
const create = (overrides: Partial<MeetupDetails> = {}) =>
  Meetup.create(
    {
      ...details,
      ...overrides,
      id: 'meetup',
      organizerId: 'alice',
      organizerParticipantId: 'pa',
      invitees: [{ id: 'pb', userId: 'bob' }],
    },
    now,
  );
const code = (value: MeetupErrorCode): Record<string, unknown> =>
  expect.objectContaining({ code: value }) as Record<string, unknown>;

describe('Meetup aggregate', () => {
  it('creates inviting with an accepted organizer and no member cap (BR-19)', () => {
    const meetup = Meetup.create(
      {
        ...details,
        id: 'large',
        organizerId: 'alice',
        organizerParticipantId: 'pa',
        invitees: Array.from({ length: 501 }, (_, n) => ({
          id: `p${n}`,
          userId: `u${n}`,
        })),
      },
      now,
    );
    expect(meetup.snapshot().status).toBe('inviting');
    expect(meetup.snapshot().participants).toHaveLength(502);
    expect(meetup.snapshot().participants[0]).toMatchObject({
      userId: 'alice',
      status: 'accepted',
    });
    expect(meetup.pendingEvents()[0].name).toBe('MeetupCreated');
  });

  it.each([
    { title: '  ' },
    { searchRadiusM: 99 },
    { searchRadiusM: 50001 },
    { searchRadiusM: 100.5 },
    { scheduledAt: now },
    { invitationDeadlineAt: now },
    { invitationDeadlineAt: new Date('2030-01-01T13:00:00Z') },
    { scheduledAt: new Date('invalid') },
    { placeType: 'invalid type' },
  ])('rejects invalid details %j', (patch) => {
    expect(() => create(patch)).toThrow(code('INVALID_INPUT'));
  });

  it('keeps recommendationMode organizer-only and rejects unknown modes', () => {
    const meetup = create();
    expect(() =>
      meetup.update('bob', { recommendationMode: 'balanced' }, now),
    ).toThrow(code('MEETUP_FORBIDDEN'));
    expect(() =>
      meetup.update(
        'alice',
        { recommendationMode: 'unknown' as 'balanced' },
        now,
      ),
    ).toThrow(code('INVALID_INPUT'));
    meetup.update(
      'alice',
      { recommendationMode: 'balanced', title: 'Tea' },
      now,
    );
    expect(meetup.snapshot()).toMatchObject({
      title: 'Tea',
      recommendationMode: 'balanced',
    });
  });

  it.each(['selected', 'cancelled', 'finished'] as MeetupStatus[])(
    'freezes details and participants in %s',
    (status) => {
      const meetup = Meetup.reconstitute({ ...create().snapshot(), status });
      for (const change of [
        () => meetup.update('alice', { title: 'Changed' }, now),
        () => meetup.invite('alice', [{ id: 'pc', userId: 'carol' }], now),
        () => meetup.respond('bob', 'accepted', now),
        () => meetup.remove('alice', 'bob', now),
      ]) {
        expect(change).toThrow(code('MEETUP_NOT_EDITABLE'));
      }
    },
  );

  it('rejects a response exactly at the invitation deadline', () => {
    const meetup = create();
    expect(() =>
      meetup.respond('bob', 'accepted', details.invitationDeadlineAt),
    ).toThrow(code('MEETUP_INVITATION_EXPIRED'));
    expect(meetup.snapshot().participants[1].status).toBe('invited');
  });

  it('accepts only once and protects the organizer from leaving/removal', () => {
    const meetup = create();
    meetup.respond('bob', 'accepted', now);
    expect(() => meetup.respond('bob', 'declined', now)).toThrow(
      code('MEETUP_MEMBER_CONFLICT'),
    );
    expect(() => meetup.leave('alice', now)).toThrow(code('MEETUP_FORBIDDEN'));
    expect(() => meetup.remove('alice', 'alice', now)).toThrow(
      code('MEETUP_FORBIDDEN'),
    );
    meetup.leave('bob', now);
    expect(meetup.snapshot().participants[1]).toMatchObject({
      status: 'left',
      leftAt: now,
    });
    expect(() => meetup.assertVisible('bob')).toThrow(code('MEETUP_NOT_FOUND'));
  });

  it('removes pending or accepted members and reinvites using the existing participant identity', () => {
    const meetup = create();
    meetup.remove('alice', 'bob', now);
    meetup.invite('alice', [{ id: 'replacement-id', userId: 'bob' }], now);
    expect(meetup.snapshot().participants[1]).toMatchObject({
      id: 'pb',
      status: 'invited',
      respondedAt: null,
      joinedAt: null,
      leftAt: null,
    });
    meetup.respond('bob', 'declined', now);
    meetup.invite('alice', [{ id: 'another-id', userId: 'bob' }], now);
    expect(meetup.snapshot().participants).toHaveLength(2);
  });

  it('rejects mixed duplicate invitations without partially changing the aggregate', () => {
    const meetup = create();
    expect(() =>
      meetup.invite(
        'alice',
        [
          { id: 'pc', userId: 'carol' },
          { id: 'pb2', userId: 'bob' },
        ],
        now,
      ),
    ).toThrow(code('MEETUP_MEMBER_CONFLICT'));
    expect(meetup.snapshot().participants).toHaveLength(2);
  });

  it('hides unrelated meetups and requires the organizer to cancel', () => {
    const meetup = create();
    expect(() => meetup.cancel('carol', now)).toThrow(code('MEETUP_NOT_FOUND'));
    expect(() => meetup.cancel('bob', now)).toThrow(code('MEETUP_FORBIDDEN'));
    meetup.cancel('alice', now);
    expect(meetup.snapshot()).toMatchObject({
      status: 'cancelled',
      cancelledAt: now,
    });
    expect(() => meetup.cancel('alice', now)).toThrow(
      code('MEETUP_INVALID_TRANSITION'),
    );
  });

  it('finishes only a selected meetup that has started', () => {
    expect(() => create().finish('alice', details.scheduledAt)).toThrow(
      code('MEETUP_INVALID_TRANSITION'),
    );
    const meetup = Meetup.reconstitute({
      ...create().snapshot(),
      status: 'selected',
    });
    expect(() => meetup.finish('alice', now)).toThrow(
      code('MEETUP_INVALID_TRANSITION'),
    );
    meetup.finish('alice', details.scheduledAt);
    expect(meetup.snapshot()).toMatchObject({
      status: 'finished',
      finishedAt: details.scheduledAt,
    });
    expect(() => meetup.cancel('alice', details.scheduledAt)).toThrow(
      code('MEETUP_INVALID_TRANSITION'),
    );
  });

  it('does not expose mutable state or events', () => {
    const meetup = create();
    meetup.snapshot().participants[0].status = 'removed';
    meetup.snapshot().scheduledAt.setFullYear(2000);
    meetup.pendingEvents()[0].recipientIds.length = 0;
    expect(meetup.snapshot().participants[0].status).toBe('accepted');
    expect(meetup.snapshot().scheduledAt.getUTCFullYear()).toBe(2030);
    expect(meetup.pendingEvents()[0].recipientIds).toEqual(['bob']);
  });

  describe('participant preferences (UC-09, BR-21)', () => {
    it('sets temporary preferences for accepted participant and emits PreferenceUpdated', () => {
      const meetup = create();
      meetup.setParticipantPreferences(
        'alice',
        [
          { activityTagId: 1, level: 'high' },
          { activityTagId: 2, level: 'avoid' },
        ],
        now,
      );

      const snapshot = meetup.snapshot();
      const alice = snapshot.participants.find((p) => p.userId === 'alice')!;
      expect(alice.preferences).toEqual([
        {
          activityTagId: 1,
          level: 'high',
          source: 'meetup_input',
          updatedAt: now,
        },
        {
          activityTagId: 2,
          level: 'avoid',
          source: 'meetup_input',
          updatedAt: now,
        },
      ]);

      const prefEvents = meetup
        .pendingEvents()
        .filter((e) => e.name === 'PreferenceUpdated');
      expect(prefEvents).toHaveLength(1);
      expect(prefEvents[0]).toMatchObject({
        name: 'PreferenceUpdated',
        meetupId: 'meetup',
        participantId: 'pa',
        userId: 'alice',
        occurredAt: now,
        recipientIds: ['alice'],
      });
    });

    it('allows invited participant to set temporary preferences before finalization', () => {
      const meetup = create();
      meetup.setParticipantPreferences(
        'bob',
        [{ activityTagId: 3, level: 'normal' }],
        now,
      );

      const bob = meetup
        .snapshot()
        .participants.find((p) => p.userId === 'bob')!;
      expect(bob.preferences).toHaveLength(1);
      expect(bob.preferences![0]).toMatchObject({
        activityTagId: 3,
        level: 'normal',
        source: 'meetup_input',
      });
    });

    it('rejects duplicate activity tag IDs or invalid levels', () => {
      const meetup = create();
      expect(() =>
        meetup.setParticipantPreferences(
          'alice',
          [
            { activityTagId: 1, level: 'high' },
            { activityTagId: 1, level: 'avoid' },
          ],
          now,
        ),
      ).toThrow(code('INVALID_INPUT'));

      expect(() =>
        meetup.setParticipantPreferences(
          'alice',
          [
            {
              activityTagId: 1,
              level: 'invalid' as 'high',
            },
          ],
          now,
        ),
      ).toThrow(code('INVALID_INPUT'));

      expect(() => meetup.setParticipantPreferences('alice', [], now)).toThrow(
        code('INVALID_INPUT'),
      );
    });

    it('rejects setting preferences when participant is not in meetup', () => {
      const meetup = create();
      expect(() =>
        meetup.setParticipantPreferences(
          'stranger',
          [{ activityTagId: 1, level: 'high' }],
          now,
        ),
      ).toThrow(code('MEETUP_NOT_FOUND'));
    });

    it('rejects setting preferences when participant has left or was removed', () => {
      const meetup = create();
      meetup.respond('bob', 'accepted', now);
      meetup.leave('bob', now);

      expect(() =>
        meetup.setParticipantPreferences(
          'bob',
          [{ activityTagId: 1, level: 'high' }],
          now,
        ),
      ).toThrow(code('MEETUP_NOT_FOUND'));
    });

    it('rejects setting preferences when meetup is cancelled or finished', () => {
      const meetup = create();
      meetup.cancel('alice', now);

      expect(() =>
        meetup.setParticipantPreferences(
          'alice',
          [{ activityTagId: 1, level: 'high' }],
          now,
        ),
      ).toThrow(code('MEETUP_NOT_EDITABLE'));
    });
  });
});
