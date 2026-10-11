import { AuthError } from '../errors/auth.error';

export const sharingModes = [
  'off',
  'friends',
  'selected_friends',
  'meetup_only',
] as const;
export type SharingMode = (typeof sharingModes)[number];

export interface PrivacySettingsState {
  id: string;
  userId: string;
  sharingMode: SharingMode;
  sharingExpiresAt: Date | null;
  useApproximateLocation: boolean;
  nearbyFeatureEnabled: boolean;
  selectedFriendIds: string[];
  updatedAt: Date;
}

export class PrivacySettings {
  private constructor(private readonly state: PrivacySettingsState) {}

  static configure(state: PrivacySettingsState, now: Date): PrivacySettings {
    const invalid = (message: string): never => {
      throw new AuthError('INVALID_INPUT', message);
    };
    if (!sharingModes.includes(state.sharingMode))
      invalid('Invalid sharing mode');
    if (
      typeof state.useApproximateLocation !== 'boolean' ||
      typeof state.nearbyFeatureEnabled !== 'boolean'
    )
      invalid('Privacy flags must be booleans');
    if (
      state.sharingExpiresAt !== null &&
      (!Number.isFinite(state.sharingExpiresAt.getTime()) ||
        state.sharingExpiresAt <= now)
    )
      invalid('Sharing expiry must be in the future');
    if (state.sharingMode === 'off' && state.sharingExpiresAt !== null)
      invalid('Disabled sharing must not have an expiry');
    const ids = state.selectedFriendIds.map((id) => id.toLowerCase());
    if (
      ids.length > 100 ||
      new Set(ids).size !== ids.length ||
      ids.includes(state.userId.toLowerCase())
    )
      invalid('Select at most 100 distinct other users');
    if (
      state.sharingMode === 'selected_friends'
        ? ids.length === 0
        : ids.length !== 0
    )
      invalid('Selected friends are required only for selected_friends mode');
    return PrivacySettings.restore({ ...state, selectedFriendIds: ids });
  }

  static restore(state: PrivacySettingsState): PrivacySettings {
    return new PrivacySettings({
      ...state,
      selectedFriendIds: [...state.selectedFriendIds],
      sharingExpiresAt: state.sharingExpiresAt
        ? new Date(state.sharingExpiresAt)
        : null,
      updatedAt: new Date(state.updatedAt),
    });
  }

  isSharingEnabled(now: Date): boolean {
    return (
      this.state.sharingMode !== 'off' &&
      (this.state.sharingExpiresAt === null ||
        this.state.sharingExpiresAt > now)
    );
  }

  snapshot(): PrivacySettingsState {
    return {
      ...this.state,
      selectedFriendIds: [...this.state.selectedFriendIds],
      sharingExpiresAt: this.state.sharingExpiresAt
        ? new Date(this.state.sharingExpiresAt)
        : null,
      updatedAt: new Date(this.state.updatedAt),
    };
  }
}
