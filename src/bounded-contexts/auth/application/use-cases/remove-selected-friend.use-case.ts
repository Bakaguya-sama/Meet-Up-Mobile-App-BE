import type { PrivacySettingsStorePort } from '../ports/persistence/privacy-settings-store.port';

/**
 * Removes one user from one owner's `selected_friend_ids`.
 *
 * Safe to call even when the target is already absent — the operation is
 * idempotent. The persistence port locks the owner row so concurrent removals
 * cannot overwrite each other.
 */
export class RemoveSelectedFriendUseCase {
  constructor(private readonly store: PrivacySettingsStorePort) {}

  async execute(input: {
    ownerId: string;
    selectedFriendId: string;
  }): Promise<void> {
    await this.store.updateLocked(input.ownerId, (settings) => {
      settings.removeSelectedFriend(input.selectedFriendId, new Date());
    });
  }
}
