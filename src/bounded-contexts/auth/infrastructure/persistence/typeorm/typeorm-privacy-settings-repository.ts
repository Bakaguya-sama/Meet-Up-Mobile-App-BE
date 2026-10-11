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

  async removeFromSelected(removedId: string): Promise<void> {
    // Remove the UUID from the array, then if mode is selected_friends and
    // the list is now empty, downgrade to 'friends' + clear the computed flag.
    await this.database.query(
      `UPDATE privacy_settings
       SET selected_friend_ids = array_remove(selected_friend_ids, $1::uuid),
           sharing_mode = CASE
             WHEN sharing_mode = 'selected_friends'
               AND cardinality(array_remove(selected_friend_ids, $1::uuid)) = 0
             THEN 'friends'
             ELSE sharing_mode
           END,
           is_location_sharing_enabled = CASE
             WHEN sharing_mode = 'selected_friends'
               AND cardinality(array_remove(selected_friend_ids, $1::uuid)) = 0
             THEN (sharing_mode <> 'off')
             ELSE is_location_sharing_enabled
           END,
           updated_at = NOW()
       WHERE $1::uuid = ANY(selected_friend_ids)`,
      [removedId],
    );
  }
}
