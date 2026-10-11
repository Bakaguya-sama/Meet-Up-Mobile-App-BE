import { randomUUID } from 'node:crypto';
import { Friendship } from '../../domain/aggregates/friendship.aggregate';
import { FriendshipError } from '../../domain/errors/friendship.error';
import type { FriendshipStorePort } from '../ports/persistence/friendship-store.port';
import type { FriendUserDirectoryPort } from '../ports/user-directory.port';
import type { FriendshipDto } from '../dto/friends-response.dto';

export class SendFriendRequestUseCase {
  constructor(
    private readonly store: FriendshipStorePort,
    private readonly users: FriendUserDirectoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    recipientId: string;
  }): Promise<FriendshipDto> {
    const friendship = Friendship.request(
      randomUUID(),
      input.actorId,
      input.recipientId,
      new Date(),
    );
    const state = friendship.snapshot();
    const users = await this.users.findActiveByIds([
      state.userAId,
      state.userBId,
    ]);
    if (users.length !== 2) {
      throw new FriendshipError(
        'FRIEND_USER_NOT_FOUND',
        'An active user account could not be found',
      );
    }
    await this.store.insert(friendship);
    return friendship.snapshot();
  }
}
