import { randomUUID } from 'node:crypto';
import { PrivacySettings } from '../../domain/aggregates/privacy-settings.aggregate';
import { AuthError } from '../../domain/errors/auth.error';
import type { SavePrivacySettingsRequest } from '../dto/privacy-settings.dto';
import type { PrivacySettingsStorePort } from '../ports/persistence/privacy-settings-store.port';
import { UserDirectory } from '../public/user-directory';
import { GetPrivacySettingsUseCase } from './get-privacy-settings.use-case';
import type { FriendshipReader } from '../../../friends/application/public/friendship-reader';
import type { FriendLiveLocationRevokerPort } from '../../../../shared-kernel/application/friend-live-location-revoker.port';

export class SavePrivacySettingsUseCase {
  constructor(
    private readonly store: PrivacySettingsStorePort,
    private readonly users: UserDirectory,
    private readonly getSettings: GetPrivacySettingsUseCase,
    private readonly friendships?: FriendshipReader,
    private readonly liveLocationRevoker?: FriendLiveLocationRevokerPort,
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
        friendLiveLocationEnabled: input.friendLiveLocationEnabled,
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
    const previous = await this.getSettings.execute(userId);
    await this.store.save(settings);
    // Remove online markers immediately when the owner revokes the only grant
    // that authorizes friend live location. The next valid publish recreates it.
    if (
      previous.friendLiveLocationEnabled &&
      (!input.friendLiveLocationEnabled ||
        input.sharingMode === 'off' ||
        input.sharingMode === 'meetup_only' ||
        (input.sharingExpiresAt !== null &&
          new Date(input.sharingExpiresAt) <= now)) &&
      this.friendships &&
      this.liveLocationRevoker
    ) {
      await Promise.allSettled(
        (await this.friendships.acceptedFriendIds(userId)).map((viewerId) =>
          this.liveLocationRevoker!.revoke(userId, viewerId, 'privacy_revoked'),
        ),
      );
    }
    return this.getSettings.execute(userId);
  }
}
