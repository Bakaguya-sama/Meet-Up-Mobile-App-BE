import { FriendshipError } from '../../domain/errors/friendship.error';
import { FriendQrSessionToken } from '../../domain/values/friend-qr-session-token';
import type {
  FriendQrSession,
  FriendQrSessionStorePort,
} from '../ports/persistence/friend-qr-session-store.port';

export async function resolveFriendQrSession(
  sessions: FriendQrSessionStorePort,
  rawToken: string,
): Promise<FriendQrSession> {
  const session = await sessions.resolve(FriendQrSessionToken.hash(rawToken));
  if (!session) throw unavailableFriendQrSession();
  return session;
}

export function unavailableFriendQrSession(): FriendshipError {
  return new FriendshipError(
    'FRIEND_USER_NOT_FOUND',
    'QR session is unavailable',
  );
}
