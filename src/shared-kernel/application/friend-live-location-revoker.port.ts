export const FRIEND_LIVE_LOCATION_REVOKER = Symbol(
  'FRIEND_LIVE_LOCATION_REVOKER',
);

export type FriendLiveLocationUnavailableReason =
  'privacy_revoked' | 'friendship_removed' | 'blocked' | 'expired';

/** Emits only an authorization-revocation marker; it never carries location data. */
export interface FriendLiveLocationRevokerPort {
  revoke(
    ownerId: string,
    viewerId: string,
    reason: FriendLiveLocationUnavailableReason,
  ): Promise<void>;
}
