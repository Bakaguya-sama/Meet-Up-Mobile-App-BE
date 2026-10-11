import { randomUUID } from 'node:crypto';
import { PrivacySettings } from '../../domain/aggregates/privacy-settings.aggregate';
import { AuthError } from '../../domain/errors/auth.error';
import type { SavePrivacySettingsRequest } from '../dto/privacy-settings.dto';
import type { PrivacySettingsStorePort } from '../ports/persistence/privacy-settings-store.port';
import { UserDirectory } from '../public/user-directory';
import { GetPrivacySettingsUseCase } from './get-privacy-settings.use-case';

export class SavePrivacySettingsUseCase {
  constructor(
    private readonly store: PrivacySettingsStorePort,
    private readonly users: UserDirectory,
    private readonly getSettings: GetPrivacySettingsUseCase,
  ) {}

  async execute(userId: string, input: SavePrivacySettingsRequest) {
    const now = new Date();
    const settings = PrivacySettings.configure(
      {
        id: randomUUID(),
        userId,
        sharingMode: input.sharingMode,
        sharingExpiresAt:
          input.sharingExpiresAt === null
            ? null
            : new Date(input.sharingExpiresAt),
        useApproximateLocation: input.useApproximateLocation,
        nearbyFeatureEnabled: input.nearbyFeatureEnabled,
        selectedFriendIds: input.selectedFriendIds,
        updatedAt: now,
      },
      now,
    );
    const ids = [userId, ...settings.snapshot().selectedFriendIds];
    if ((await this.users.findActiveByIds(ids)).length !== ids.length)
      throw new AuthError(
        'ACCOUNT_NOT_FOUND',
        'An active selected account could not be found',
      );
    await this.store.save(settings);
    return this.getSettings.execute(userId);
  }
}
