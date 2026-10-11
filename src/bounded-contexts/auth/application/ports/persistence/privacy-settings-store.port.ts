import type { PrivacySettings } from '../../../domain/aggregates/privacy-settings.aggregate';

export const PRIVACY_SETTINGS_STORE = Symbol('PRIVACY_SETTINGS_STORE');

export interface PrivacySettingsStorePort {
  findByUserId(userId: string): Promise<PrivacySettings | null>;
  /** Atomic full replacement, preserving an existing row's identity. */
  save(settings: PrivacySettings): Promise<void>;
  /**
   * Atomically remove `removedId` from every user's `selected_friend_ids`.
   * If removing leaves the list empty for a `selected_friends` row, the mode
   * is downgraded to `friends` so the DB constraint is never violated.
   * No-op when the row does not exist or `removedId` is not in the list.
   */
  removeFromSelected(removedId: string): Promise<void>;
}
