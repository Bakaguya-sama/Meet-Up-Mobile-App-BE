import type { PrivacySettingsStorePort } from '../ports/persistence/privacy-settings-store.port';
import { LocationPrivacyReader } from '../public/location-privacy-reader';
import { UserDirectory } from '../public/user-directory';
import type { PrivacySettingsDto } from '../dto/privacy-settings.dto';
import { AuthError } from '../../domain/errors/auth.error';

export class GetPrivacySettingsUseCase extends LocationPrivacyReader {
  constructor(
    private readonly store: PrivacySettingsStorePort,
    private readonly users: UserDirectory,
  ) {
    super();
  }

  async read(userId: string): Promise<PrivacySettingsDto | null> {
    if (!(await this.users.findActiveByIds([userId])).length) return null;
    const settings = await this.store.findByUserId(userId);
    if (!settings)
      return {
        sharingMode: 'off',
        sharingExpiresAt: null,
        isLocationSharingEnabled: false,
        useApproximateLocation: false,
        nearbyFeatureEnabled: false,
        selectedFriendIds: [],
        updatedAt: null,
      };
    const {
      sharingMode,
      sharingExpiresAt,
      useApproximateLocation,
      nearbyFeatureEnabled,
      selectedFriendIds,
      updatedAt,
    } = settings.snapshot();
    return {
      sharingMode,
      sharingExpiresAt,
      useApproximateLocation,
      nearbyFeatureEnabled,
      selectedFriendIds,
      updatedAt,
      isLocationSharingEnabled: settings.isSharingEnabled(new Date()),
    };
  }

  async execute(userId: string): Promise<PrivacySettingsDto> {
    const settings = await this.read(userId);
    if (!settings)
      throw new AuthError('ACCOUNT_NOT_FOUND', 'Active user account not found');
    return settings;
  }
}
