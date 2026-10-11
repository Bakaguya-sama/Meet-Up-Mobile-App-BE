import { UnfriendUseCase } from './unfriend.use-case';
import { Friendship } from '../../domain/aggregates/friendship.aggregate';
import type { FriendshipStorePort } from '../ports/persistence/friendship-store.port';
import type { PrivacySelectedFriendPurge } from '../../../auth/application/public/privacy-selected-friend-purge';

describe('UnfriendUseCase', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const userA = 'aaaaaaaa-0000-4000-8000-000000000001';
  const userB = 'bbbbbbbb-0000-4000-8000-000000000002';
  const requestId = 'rrrrrrrr-0000-4000-8000-000000000001';

  let friendship: Friendship;
  let store: jest.Mocked<FriendshipStorePort>;
  let purge: jest.Mocked<PrivacySelectedFriendPurge>;
  let useCase: UnfriendUseCase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    friendship = Friendship.restore({
      id: requestId,
      userAId: userA,
      userBId: userB,
      requestedById: userA,
      status: 'accepted',
      requestedAt: new Date(now.getTime() - 10000),
      respondedAt: new Date(now.getTime() - 5000),
      updatedAt: new Date(now.getTime() - 5000),
    });
    store = {
      insert: jest.fn(),
      updateLocked: jest.fn((id, change) => {
        change(friendship);
        return Promise.resolve(friendship.snapshot());
      }),
      findForUsers: jest.fn(),
      list: jest.fn(),
    };
    purge = { removeFromOwnerSelection: jest.fn().mockResolvedValue(undefined) };
    useCase = new UnfriendUseCase(store, purge);
  });
  afterEach(() => jest.useRealTimers());

  it('marks the friendship rejected and purges only the former pair', async () => {
    await useCase.execute({ actorId: userA, requestId });
    expect(friendship.snapshot().status).toBe('rejected');
    expect(purge.removeFromOwnerSelection.mock.calls).toEqual([
      [userA, userB],
      [userB, userA],
    ]);
  });

  it('both parties can initiate the unfriend', async () => {
    await useCase.execute({ actorId: userB, requestId });
    expect(friendship.snapshot().status).toBe('rejected');
  });

  it('still removes the friendship even if the privacy purge fails', async () => {
    purge.removeFromOwnerSelection.mockRejectedValue(new Error('purge failed'));
    await expect(
      useCase.execute({ actorId: userA, requestId }),
    ).resolves.toBeUndefined();
    expect(friendship.snapshot().status).toBe('rejected');
  });

  it('rejects when the friendship is not accepted', async () => {
    const pendingFriendship = Friendship.restore({
      ...friendship.snapshot(),
      status: 'pending',
    });
    store.updateLocked.mockImplementationOnce((_, change) => {
      change(pendingFriendship);
      return Promise.resolve(pendingFriendship.snapshot());
    });
    await expect(
      useCase.execute({ actorId: userA, requestId }),
    ).rejects.toMatchObject({ code: 'FRIENDSHIP_NOT_ACCEPTED' });
  });
});
