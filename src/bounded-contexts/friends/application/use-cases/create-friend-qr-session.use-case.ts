import { randomUUID } from 'node:crypto';
import type { FriendQrSessionStorePort } from '../ports/persistence/friend-qr-session-store.port';
import { FriendQrSessionToken } from '../../domain/values/friend-qr-session-token';

export class CreateFriendQrSessionUseCase {
  constructor(
    private readonly store: FriendQrSessionStorePort,
    private readonly sessionTtlSeconds: number,
    private readonly publicAppBaseUrl: string,
  ) {}

  async execute(ownerId: string) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      // Set the advertised deadline before Redis starts the TTL. Returning a
      // later timestamp could make the QR appear valid after Redis expires it.
      const expiresAt = new Date(Date.now() + this.sessionTtlSeconds * 1000);
      const token = FriendQrSessionToken.issue();
      const sessionId = randomUUID();
      const stored = await this.store.create({
        tokenHash: token.tokenHash,
        sessionId,
        ownerId: ownerId.toLowerCase(),
        ttlSeconds: this.sessionTtlSeconds,
      });
      if (!stored) continue;

      const baseUrl = this.publicAppBaseUrl.replace(/\/+$/, '');
      return {
        sessionId,
        qrUrl: `${baseUrl}/friends/qr-sessions/${token.rawToken}`,
        expiresAt,
      };
    }
    throw new Error('Could not allocate a unique friend QR session');
  }
}
