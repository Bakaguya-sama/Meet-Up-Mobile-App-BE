import type { TemporaryQrProfileDto } from '../dto/friends-response.dto';
import type { FriendshipStorePort } from '../ports/persistence/friendship-store.port';
import type { FriendQrSessionStorePort } from '../ports/persistence/friend-qr-session-store.port';
import type { FriendUserDirectoryPort } from '../ports/user-directory.port';
import {
  resolveFriendQrSession,
  unavailableFriendQrSession,
} from './resolve-friend-qr-session';

export class PreviewFriendQrSessionUseCase {
  constructor(
    private readonly sessions: FriendQrSessionStorePort,
    private readonly friendships: FriendshipStorePort,
    private readonly users: FriendUserDirectoryPort,
  ) {}

  async execute(
    actorId: string,
    rawToken: string,
  ): Promise<TemporaryQrProfileDto> {
    const session = await resolveFriendQrSession(this.sessions, rawToken);
    const profile = (await this.users.findActiveByIds([session.ownerId]))[0];
    if (!profile) throw unavailableFriendQrSession();

    const relationship =
      session.ownerId === actorId
        ? []
        : await this.friendships.findForUsers(actorId, [session.ownerId]);
    return {
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      friendship: relationship[0]?.status ?? null,
    };
  }
}
