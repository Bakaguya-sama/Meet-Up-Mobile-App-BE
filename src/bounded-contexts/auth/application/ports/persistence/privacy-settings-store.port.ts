import type { PrivacySettings } from '../../../domain/aggregates/privacy-settings.aggregate';

export const PRIVACY_SETTINGS_STORE = Symbol('PRIVACY_SETTINGS_STORE');

export interface PrivacySettingsStorePort {
  findByUserId(userId: string): Promise<PrivacySettings | null>;
  /** Atomic full replacement, preserving an existing row's identity. */
  save(settings: PrivacySettings): Promise<void>;
  /** Runs one aggregate mutation while holding the owner's settings row lock. */
  updateLocked(
    userId: string,
    change: (settings: PrivacySettings) => void,
  ): Promise<void>;
}
