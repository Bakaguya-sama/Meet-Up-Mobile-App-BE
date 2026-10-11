import type { PrivacySettingsStorePort } from '../ports/persistence/privacy-settings-store.port';

/**
 * Removes one user from the caller's `selected_friend_ids`.
 *
 * Safe to call even when the target is already absent — the operation is
 * idempotent. When removing the last selected friend the mode is atomically
 * downgraded to `friends` by the repository so DB constraints are never
 * violated.
 *
 * This use case deliberately does NOT re-validate the full aggregate because
 * it is also invoked by the unfriend purge hook where the removed user is no
 * longer a valid friend — running full aggregate validation would surface a
 * false "account not found" error.
 */
export class RemoveSelectedFriendUseCase {
  constructor(private readonly store: PrivacySettingsStorePort) {}

  /** @param actorId — owner of the privacy settings row (currently unused
   *  because the SQL WHERE targets the removedId column-wide, but kept for
   *  future per-user scoping). */
  async execute(removedId: string): Promise<void> {
    await this.store.removeFromSelected(removedId);
  }
}
