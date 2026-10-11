import type {
  Friendship,
  FriendshipState,
} from '../../../domain/aggregates/friendship.aggregate';

export const FRIENDSHIP_STORE = Symbol('FRIENDSHIP_STORE');

export interface FriendshipStorePort {
  insert(friendship: Friendship): Promise<void>;
  /** Row lock, domain mutation and persistence must share one transaction. */
  updateLocked(
    id: string,
    change: (friendship: Friendship) => void,
  ): Promise<FriendshipState>;
  findForUsers(actorId: string, userIds: string[]): Promise<FriendshipState[]>;
  list(input: {
    actorId: string;
    kind: 'accepted' | 'received' | 'sent';
    offset: number;
    limit: number;
  }): Promise<{ items: FriendshipState[]; total: number }>;
}
