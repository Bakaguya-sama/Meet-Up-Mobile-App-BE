import type { PrivacySelectedFriendPurge } from '../../../auth/application/public/privacy-selected-friend-purge';
import type { FriendshipStorePort } from '../ports/persistence/friendship-store.port';
import type { FriendLiveLocationRevokerPort } from '../../../../shared-kernel/application/friend-live-location-revoker.port';

/**
 * Removes a friendship AND purges the pair from each other's
 * `selected_friend_ids`. Called from the Friends HTTP layer (unfriend).
 *
 * The friendship is updated first so the removal is always committed.
 * The privacy purge is best-effort: if it fails the friendship is still
 * removed and the privacy check service rechecks friendship on every request,
 * so stale selected IDs can never grant access.
 */
export class UnfriendUseCase {
  constructor(
    private readonly store: FriendshipStorePort,
    private readonly privacyPurge: PrivacySelectedFriendPurge,
    private readonly liveLocationRevoker: FriendLiveLocationRevokerPort = {
      revoke: async () => undefined,
    },
  ) {}

  async execute(input: { actorId: string; requestId: string }): Promise<void> {
    // Mark the friendship as rejected (which effectively removes it).
    const state = await this.store.updateLocked(
      input.requestId,
      (friendship) => {
        friendship.unfriend(input.actorId, new Date());
      },
    );

    // Best-effort: only purge the pair that was just disconnected.
    await Promise.allSettled([
      this.privacyPurge.removeFromOwnerSelection(state.userAId, state.userBId),
      this.privacyPurge.removeFromOwnerSelection(state.userBId, state.userAId),
      this.liveLocationRevoker.revoke(
        state.userAId,
        state.userBId,
        'friendship_removed',
      ),
      this.liveLocationRevoker.revoke(
        state.userBId,
        state.userAId,
        'friendship_removed',
      ),
    ]);
  }
}
