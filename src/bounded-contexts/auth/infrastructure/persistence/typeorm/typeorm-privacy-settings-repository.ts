import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { PrivacySettingsStorePort } from '../../../application/ports/persistence/privacy-settings-store.port';
import { PrivacySettings } from '../../../domain/aggregates/privacy-settings.aggregate';
import { PrivacySettingsEntity } from './entities/privacy-settings.typeorm-entity';

@Injectable()
export class TypeOrmPrivacySettingsRepository implements PrivacySettingsStorePort {
  constructor(private readonly database: DataSource) {}

  async findByUserId(userId: string) {
    const row = await this.database
      .getRepository(PrivacySettingsEntity)
      .findOneBy({ userId });
    return row
      ? PrivacySettings.restore({
          id: row.id,
          userId: row.userId,
          sharingMode: row.sharingMode,
          sharingExpiresAt: row.sharingExpiresAt,
          useApproximateLocation: row.useApproximateLocation,
          nearbyFeatureEnabled: row.nearbyFeatureEnabled,
          selectedFriendIds: row.selectedFriendIds,
          updatedAt: row.updatedAt,
        })
      : null;
  }

  async save(settings: PrivacySettings): Promise<void> {
    const state = settings.snapshot();
    await this.database
      .createQueryBuilder()
      .insert()
      .into(PrivacySettingsEntity)
      .values({
        ...state,
        isLocationSharingEnabled: state.sharingMode !== 'off',
      })
      .onConflict(
        `("user_id") DO UPDATE SET
        sharing_mode = EXCLUDED.sharing_mode,
        is_location_sharing_enabled = EXCLUDED.is_location_sharing_enabled,
        sharing_expires_at = EXCLUDED.sharing_expires_at,
        use_approximate_location = EXCLUDED.use_approximate_location,
        nearby_feature_enabled = EXCLUDED.nearby_feature_enabled,
        selected_friend_ids = EXCLUDED.selected_friend_ids,
        updated_at = EXCLUDED.updated_at`,
      )
      .execute();
  }
}
