import type { FriendshipStorePort } from '../ports/persistence/friendship-store.port';

/** Public read API; consumers must not read the Friends tables themselves. */
export class FriendshipReader {
  constructor(private readonly store: FriendshipStorePort) {}

  async areAccepted(userId: string, otherId: string): Promise<boolean> {
    if (userId.toLowerCase() === otherId.toLowerCase()) return false;
    const relationships = await this.store.findForUsers(userId, [otherId]);
    return relationships.some(
      (relationship) => relationship.status === 'accepted',
    );
  }
}
