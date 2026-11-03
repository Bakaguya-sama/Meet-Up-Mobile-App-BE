import type { FriendQrSessionStorePort } from '../ports/persistence/friend-qr-session-store.port';
import type { FriendUserDirectoryPort } from '../ports/user-directory.port';
import {
  resolveFriendQrSession,
  unavailableFriendQrSession,
} from './resolve-friend-qr-session';

export class ResolveFriendQrSessionRecipientUseCase {
  constructor(
    private readonly sessions: FriendQrSessionStorePort,
    private readonly users: FriendUserDirectoryPort,
  ) {}

  async execute(rawToken: string): Promise<string> {
    const session = await resolveFriendQrSession(this.sessions, rawToken);
    const [activeOwner] = await this.users.findActiveByIds([session.ownerId]);
    if (!activeOwner) throw unavailableFriendQrSession();
    return activeOwner.id;
  }
}
