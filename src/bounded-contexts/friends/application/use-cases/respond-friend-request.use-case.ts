import type { FriendshipStorePort } from '../ports/persistence/friendship-store.port';
import type { FriendshipDto } from '../dto/friends-response.dto';

export class RespondFriendRequestUseCase {
  constructor(private readonly store: FriendshipStorePort) {}

  execute(input: {
    actorId: string;
    requestId: string;
    decision: 'accepted' | 'rejected';
  }): Promise<FriendshipDto> {
    return this.store.updateLocked(input.requestId, (friendship) => {
      friendship.respond(input.actorId, input.decision, new Date());
    });
  }
}
