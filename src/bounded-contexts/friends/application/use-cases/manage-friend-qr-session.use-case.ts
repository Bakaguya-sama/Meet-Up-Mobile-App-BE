import { FriendshipError } from '../../domain/errors/friendship.error';
import { FriendQrSessionToken } from '../../domain/values/friend-qr-session-token';
import type { FriendshipStorePort } from '../ports/persistence/friendship-store.port';
import type { FriendQrSessionStorePort } from '../ports/persistence/friend-qr-session-store.port';
import type { FriendUserDirectoryPort } from '../ports/user-directory.port';
import type { TemporaryQrProfileDto } from '../dto/friends-response.dto';

export class ManageFriendQrSessionUseCase {
  constructor(
    private readonly sessions: FriendQrSessionStorePort,
    private readonly friendships: FriendshipStorePort,
    private readonly users: FriendUserDirectoryPort,
  ) {}

  async preview(
    actorId: string,
    rawToken: string,
  ): Promise<TemporaryQrProfileDto> {
    const session = await this.resolve(rawToken);
    const profile = (await this.users.findActiveByIds([session.ownerId]))[0];
    if (!profile) throw unavailableQrSession();

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

  async resolveRecipientId(rawToken: string): Promise<string> {
    const session = await this.resolve(rawToken);
    const [activeOwner] = await this.users.findActiveByIds([session.ownerId]);
    if (!activeOwner) throw unavailableQrSession();
    return activeOwner.id;
  }

  async revoke(ownerId: string, sessionId: string): Promise<void> {
    if (
      !(await this.sessions.revoke(
        ownerId.toLowerCase(),
        sessionId.toLowerCase(),
      ))
    ) {
      throw unavailableQrSession();
    }
  }

  private async resolve(rawToken: string) {
    const session = await this.sessions.resolve(
      FriendQrSessionToken.hash(rawToken),
    );
    if (!session) throw unavailableQrSession();
    return session;
  }
}

function unavailableQrSession(): FriendshipError {
  return new FriendshipError(
    'FRIEND_USER_NOT_FOUND',
    'QR session is unavailable',
  );
}
