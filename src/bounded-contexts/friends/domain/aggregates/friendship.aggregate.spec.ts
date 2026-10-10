import { Friendship } from './friendship.aggregate';
import { FriendshipError } from '../errors/friendship.error';

function failureCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    if (error instanceof FriendshipError) return error.code;
    throw error;
  }
  throw new Error('Expected a friendship domain error');
}

const alice = 'aaaaaaaa-0000-4000-8000-000000000001';
const bob = 'bbbbbbbb-0000-4000-8000-000000000002';
const createdAt = new Date('2026-10-10T00:00:00Z');
const respondedAt = new Date('2026-10-10T00:01:00Z');

describe('Friendship', () => {
  it('canonicalizes crossed pairs while retaining the actual sender', () => {
    const state = Friendship.request(
      'request',
      bob.toUpperCase(),
      alice,
      createdAt,
    ).snapshot();
    expect(state).toMatchObject({
      userAId: alice,
      userBId: bob,
      requestedById: bob,
      status: 'pending',
      respondedAt: null,
    });
  });

  it('rejects self-friendship even when UUID casing differs', () => {
    expect(
      failureCode(() =>
        Friendship.request('request', alice, alice.toUpperCase(), createdAt),
      ),
    ).toBe('SELF_FRIENDSHIP');
  });

  it.each(['accepted', 'rejected'] as const)(
    'allows only the recipient to mark a pending request %s',
    (decision) => {
      const friendship = Friendship.request('request', alice, bob, createdAt);
      friendship.respond(bob, decision, respondedAt);
      expect(friendship.snapshot()).toMatchObject({
        status: decision,
        requestedAt: createdAt,
        respondedAt,
        updatedAt: respondedAt,
      });
      expect(
        failureCode(() => friendship.respond(bob, decision, respondedAt)),
      ).toBe('FRIENDSHIP_NOT_PENDING');
    },
  );

  it('forbids sender approval and hides requests from outsiders', () => {
    const friendship = Friendship.request('request', alice, bob, createdAt);
    expect(
      failureCode(() => friendship.respond(alice, 'accepted', respondedAt)),
    ).toBe('FRIENDSHIP_RESPONSE_FORBIDDEN');
    expect(
      failureCode(() =>
        friendship.respond('outsider', 'rejected', respondedAt),
      ),
    ).toBe('FRIENDSHIP_NOT_FOUND');
    expect(friendship.snapshot().status).toBe('pending');
  });

  it.each(['accepted', 'rejected', 'blocked'] as const)(
    'cannot respond to a %s relationship',
    (status) => {
      const state = Friendship.request(
        'request',
        alice,
        bob,
        createdAt,
      ).snapshot();
      const friendship = Friendship.restore({ ...state, status, respondedAt });
      expect(
        failureCode(() => friendship.respond(bob, 'accepted', respondedAt)),
      ).toBe('FRIENDSHIP_NOT_PENDING');
    },
  );
});
