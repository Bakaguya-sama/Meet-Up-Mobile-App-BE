export const FRIEND_QR_SESSION_STORE = Symbol('FRIEND_QR_SESSION_STORE');

export interface FriendQrSession {
  ownerId: string;
  sessionId: string;
}

export interface FriendQrSessionStorePort {
  create(input: {
    tokenHash: string;
    sessionId: string;
    ownerId: string;
    ttlSeconds: number;
  }): Promise<boolean>;
  resolve(tokenHash: string): Promise<FriendQrSession | null>;
  revoke(ownerId: string, sessionId: string): Promise<boolean>;
}
