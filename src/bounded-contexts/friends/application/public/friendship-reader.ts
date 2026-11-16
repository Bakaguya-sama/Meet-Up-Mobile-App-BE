import type { FriendshipStorePort } from '../ports/persistence/friendship-store.port';

/** Public read API; consumers must not read the Friends tables themselves. */
export class FriendshipReader {
  constructor(private readonly store: FriendshipStorePort) {}

  /** Batch contract for invitations; avoids one database roundtrip per invitee. */
  async acceptedUserIds(userId: string, otherIds: string[]): Promise<string[]> {
    const actorId = userId.toLowerCase();
    const ids = [...new Set(otherIds.map((id) => id.toLowerCase()))].filter(
      (id) => id !== actorId,
    );
    const accepted: string[] = [];
    for (let offset = 0; offset < ids.length; offset += 500) {
      const rows = await this.store.findForUsers(
        actorId,
        ids.slice(offset, offset + 500),
      );
      accepted.push(
        ...rows
          .filter((row) => row.status === 'accepted')
          .map((row) => (row.userAId === actorId ? row.userBId : row.userAId)),
      );
    }
    return accepted;
  }

  async areAccepted(userId: string, otherId: string): Promise<boolean> {
    if (userId.toLowerCase() === otherId.toLowerCase()) return false;
    const relationships = await this.store.findForUsers(userId, [otherId]);
    return relationships.some(
      (relationship) => relationship.status === 'accepted',
    );
  }

  async acceptedFriendIds(userId: string): Promise<string[]> {
    const actorId = userId.toLowerCase();
    const result: string[] = [];
    for (let offset = 0; ; offset += 500) {
      const page = await this.store.list({
        actorId,
        kind: 'accepted',
        offset,
        limit: 500,
      });
      result.push(
        ...page.items.map((row) =>
          row.userAId === actorId ? row.userBId : row.userAId,
        ),
      );
      if (offset + page.items.length >= page.total) return result;
    }
  }
}
