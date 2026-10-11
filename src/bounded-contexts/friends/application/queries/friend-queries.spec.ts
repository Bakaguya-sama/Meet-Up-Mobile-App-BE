import type { FriendshipStorePort } from '../ports/persistence/friendship-store.port';
import type { FriendUserDirectoryPort } from '../ports/user-directory.port';
import { Friendship } from '../../domain/aggregates/friendship.aggregate';
import { SearchUsersQuery } from './search-users.query';
import { ListFriendshipsQuery } from './list-friendships.query';

describe('Friend queries', () => {
  const alice = 'alice';
  const bob = { id: 'bob', displayName: 'Bob', avatarUrl: null };
  const carol = { id: 'carol', displayName: 'Carol', avatarUrl: null };
  let store: jest.Mocked<FriendshipStorePort>;
  let users: jest.Mocked<FriendUserDirectoryPort>;

  beforeEach(() => {
    store = {
      insert: jest.fn(),
      updateLocked: jest.fn(),
      findForUsers: jest.fn(),
      list: jest.fn(),
    };
    users = { search: jest.fn(), findActiveByIds: jest.fn() };
  });

  it('attaches relationship direction to search results with one batch read', async () => {
    const friendship = Friendship.request(
      'request',
      bob.id,
      alice,
      new Date(),
    ).snapshot();
    users.search.mockResolvedValue({ items: [bob, carol], total: 7 });
    store.findForUsers.mockResolvedValue([friendship]);
    const result = await new SearchUsersQuery(store, users).execute({
      actorId: alice,
      query: 'o',
      offset: 0,
      limit: 2,
    });
    expect(result).toEqual({
      items: [
        { ...bob, friendship },
        { ...carol, friendship: null },
      ],
      total: 7,
      offset: 0,
      limit: 2,
    });
    expect(store.findForUsers.mock.calls).toEqual([[alice, ['bob', 'carol']]]);
  });

  it('hydrates both pair directions and retains a null profile for unavailable accounts', async () => {
    const first = Friendship.request(
      'first',
      alice,
      bob.id,
      new Date(),
    ).snapshot();
    const second = Friendship.request(
      'second',
      bob.id,
      carol.id,
      new Date(),
    ).snapshot();
    store.list.mockResolvedValue({ items: [first, second], total: 2 });
    users.findActiveByIds.mockResolvedValue([carol]);
    const result = await new ListFriendshipsQuery(store, users).execute({
      actorId: bob.id,
      kind: 'received',
      offset: 0,
      limit: 20,
    });
    expect(users.findActiveByIds.mock.calls).toEqual([[['alice', 'carol']]]);
    expect(result.items.map((item) => item.user)).toEqual([null, carol]);
    expect(result.total).toBe(2);
  });
});
