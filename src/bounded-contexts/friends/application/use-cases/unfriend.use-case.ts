import type { PrivacySelectedFriendPurge } from '../../../auth/application/public/privacy-selected-friend-purge';
import type { FriendshipStorePort } from '../ports/persistence/friendship-store.port';

/**
 * Removes a friendship AND purges both parties from each other's
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
  ) {}

  async execute(input: { actorId: string; requestId: string }): Promise<void> {
    // Mark the friendship as rejected (which effectively removes it).
    const state = await this.store.updateLocked(
      input.requestId,
      (friendship) => {
        friendship.unfriend(input.actorId, new Date());
      },
    );

    // Best-effort: purge both parties from each other's selected audience.
    await Promise.allSettled([
      this.privacyPurge.purge(state.userAId),
      this.privacyPurge.purge(state.userBId),
    ]);
  }
}
