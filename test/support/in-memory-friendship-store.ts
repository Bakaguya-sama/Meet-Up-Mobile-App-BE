import type { FriendshipStorePort } from '../../src/bounded-contexts/friends/application/ports/persistence/friendship-store.port';
import {
  Friendship,
  type FriendshipState,
} from '../../src/bounded-contexts/friends/domain/aggregates/friendship.aggregate';
import { FriendshipError } from '../../src/bounded-contexts/friends/domain/errors/friendship.error';

/** HTTP contract test double; does not verify database concurrency. */
export class InMemoryFriendshipStore implements FriendshipStorePort {
  readonly rows = new Map<string, FriendshipState>();

  insert(friendship: Friendship): Promise<void> {
    const state = friendship.snapshot();
    if (
      [...this.rows.values()].some(
        (row) => row.userAId === state.userAId && row.userBId === state.userBId,
      )
    ) {
      return Promise.reject(
        new FriendshipError('FRIENDSHIP_ALREADY_EXISTS', 'Already exists'),
      );
    }
    this.rows.set(state.id, state);
    return Promise.resolve();
  }

  updateLocked(
    id: string,
    change: (friendship: Friendship) => void,
  ): Promise<FriendshipState> {
    const row = this.rows.get(id);
    if (!row)
      return Promise.reject(
        new FriendshipError('FRIENDSHIP_NOT_FOUND', 'Not found'),
      );
    const friendship = Friendship.restore(row);
    change(friendship);
    const state = friendship.snapshot();
    this.rows.set(id, state);
    return Promise.resolve(state);
  }

  findForUsers(actorId: string, userIds: string[]) {
    return Promise.resolve(
      [...this.rows.values()].filter(
        (row) =>
          (row.userAId === actorId && userIds.includes(row.userBId)) ||
          (row.userBId === actorId && userIds.includes(row.userAId)),
      ),
    );
  }

  list(input: {
    actorId: string;
    kind: 'accepted' | 'received' | 'sent';
    offset: number;
    limit: number;
  }) {
    const rows = [...this.rows.values()].filter(
      (row) =>
        (row.userAId === input.actorId || row.userBId === input.actorId) &&
        (input.kind === 'accepted'
          ? row.status === 'accepted'
          : row.status === 'pending' &&
            (input.kind === 'sent'
              ? row.requestedById === input.actorId
              : row.requestedById !== input.actorId)),
    );
    return Promise.resolve({
      items: rows.slice(input.offset, input.offset + input.limit),
      total: rows.length,
    });
  }
}
