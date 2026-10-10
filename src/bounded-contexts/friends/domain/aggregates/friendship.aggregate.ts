import { FriendshipError } from '../errors/friendship.error';

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export interface FriendshipState {
  id: string;
  userAId: string;
  userBId: string;
  requestedById: string;
  status: FriendshipStatus;
  requestedAt: Date;
  respondedAt: Date | null;
  updatedAt: Date;
}

export class Friendship {
  private constructor(private readonly state: FriendshipState) {}

  static request(id: string, actorId: string, recipientId: string, now: Date) {
    const [userAId, userBId] = [
      actorId.toLowerCase(),
      recipientId.toLowerCase(),
    ].sort();
    if (userAId === userBId) {
      throw new FriendshipError(
        'SELF_FRIENDSHIP',
        'Cannot send a friend request to yourself',
      );
    }
    return new Friendship({
      id,
      userAId,
      userBId,
      requestedById: actorId.toLowerCase(),
      status: 'pending',
      requestedAt: now,
      respondedAt: null,
      updatedAt: now,
    });
  }

  static restore(state: FriendshipState) {
    return new Friendship({ ...state });
  }

  respond(actorId: string, decision: 'accepted' | 'rejected', now: Date) {
    const actor = actorId.toLowerCase();
    if (actor !== this.state.userAId && actor !== this.state.userBId) {
      throw new FriendshipError(
        'FRIENDSHIP_NOT_FOUND',
        'Friend request not found',
      );
    }
    if (actor === this.state.requestedById) {
      throw new FriendshipError(
        'FRIENDSHIP_RESPONSE_FORBIDDEN',
        'Only the recipient can respond to a friend request',
      );
    }
    if (this.state.status !== 'pending') {
      throw new FriendshipError(
        'FRIENDSHIP_NOT_PENDING',
        'Friend request is no longer pending',
      );
    }
    this.state.status = decision;
    this.state.respondedAt = now;
    this.state.updatedAt = now;
  }

  snapshot(): FriendshipState {
    return {
      ...this.state,
      requestedAt: new Date(this.state.requestedAt),
      respondedAt: this.state.respondedAt
        ? new Date(this.state.respondedAt)
        : null,
      updatedAt: new Date(this.state.updatedAt),
    };
  }
}
