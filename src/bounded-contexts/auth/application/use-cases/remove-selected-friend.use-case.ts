import type { PrivacySettingsStorePort } from '../ports/persistence/privacy-settings-store.port';

/**
 * Removes one user from one owner's `selected_friend_ids`.
 *
 * Safe to call even when the target is already absent — the operation is
 * idempotent. When removing the last selected friend the mode is atomically
 * downgraded to `friends` by the aggregate.
 */
export class RemoveSelectedFriendUseCase {
  constructor(private readonly store: PrivacySettingsStorePort) {}

  async execute(input: {
    ownerId: string;
    selectedFriendId: string;
  }): Promise<void> {
    const settings = await this.store.findByUserId(input.ownerId);
    if (!settings) return;

    settings.removeSelectedFriend(input.selectedFriendId, new Date());
    await this.store.save(settings);
  }
}
