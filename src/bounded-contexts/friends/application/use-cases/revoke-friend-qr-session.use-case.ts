import type { FriendQrSessionStorePort } from '../ports/persistence/friend-qr-session-store.port';
import { unavailableFriendQrSession } from './resolve-friend-qr-session';

export class RevokeFriendQrSessionUseCase {
  constructor(private readonly sessions: FriendQrSessionStorePort) {}

  async execute(ownerId: string, sessionId: string): Promise<void> {
    const revoked = await this.sessions.revoke(
      ownerId.toLowerCase(),
      sessionId.toLowerCase(),
    );
    if (!revoked) throw unavailableFriendQrSession();
  }
}
