import { SendFriendRequestUseCase } from './send-friend-request.use-case';
import type { FriendshipStorePort } from '../ports/persistence/friendship-store.port';
import type { FriendUserDirectoryPort } from '../ports/user-directory.port';
import { FriendshipError } from '../../domain/errors/friendship.error';

describe('SendFriendRequestUseCase', () => {
  const alice = 'aaaaaaaa-0000-4000-8000-000000000001';
  const bob = 'bbbbbbbb-0000-4000-8000-000000000002';
  let store: jest.Mocked<FriendshipStorePort>;
  let users: jest.Mocked<FriendUserDirectoryPort>;
  let useCase: SendFriendRequestUseCase;

  beforeEach(() => {
    store = {
      insert: jest.fn(),
      updateLocked: jest.fn(),
      findForUsers: jest.fn(),
      list: jest.fn(),
    };
    users = {
      search: jest.fn(),
      findActiveByIds: jest
        .fn()
        .mockResolvedValue(
          [alice, bob].map((id) => ({ id, displayName: id, avatarUrl: null })),
        ),
    };
    useCase = new SendFriendRequestUseCase(store, users);
  });

  it('creates a pending request for two active accounts', async () => {
    const result = await useCase.execute({ actorId: alice, recipientId: bob });
    expect(result).toMatchObject({
      status: 'pending',
      requestedById: alice,
      userAId: alice,
      userBId: bob,
      respondedAt: null,
    });
    expect(store.insert.mock.calls).toHaveLength(1);
  });

  it('does not persist an invitation to a missing, locked or deleted account', async () => {
    users.findActiveByIds.mockResolvedValue([
      { id: alice, displayName: 'Alice', avatarUrl: null },
    ]);
    await expect(
      useCase.execute({ actorId: alice, recipientId: bob }),
    ).rejects.toMatchObject({ code: 'FRIEND_USER_NOT_FOUND' });
    expect(store.insert.mock.calls).toHaveLength(0);
  });

  it('rejects self requests before querying other contexts', async () => {
    await expect(
      useCase.execute({ actorId: alice, recipientId: alice.toUpperCase() }),
    ).rejects.toMatchObject({ code: 'SELF_FRIENDSHIP' });
    expect(users.findActiveByIds.mock.calls).toHaveLength(0);
    expect(store.insert.mock.calls).toHaveLength(0);
  });

  it('preserves a duplicate conflict from the atomic store operation', async () => {
    store.insert.mockRejectedValue(
      new FriendshipError('FRIENDSHIP_ALREADY_EXISTS', 'Already exists'),
    );
    await expect(
      useCase.execute({ actorId: bob, recipientId: alice }),
    ).rejects.toMatchObject({ code: 'FRIENDSHIP_ALREADY_EXISTS' });
  });
});
