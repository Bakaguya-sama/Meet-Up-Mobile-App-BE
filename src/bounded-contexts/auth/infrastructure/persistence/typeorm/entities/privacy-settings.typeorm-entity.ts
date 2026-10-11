import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { SharingMode } from '../../../../domain/aggregates/privacy-settings.aggregate';

@Entity('privacy_settings')
@Index('uq_privacy_settings_user', ['userId'], { unique: true })
@Check(
  'chk_privacy_settings_enabled',
  "is_location_sharing_enabled = (sharing_mode <> 'off')",
)
@Check(
  'chk_privacy_settings_mode',
  "sharing_mode IN ('off', 'friends', 'selected_friends', 'meetup_only')",
)
@Check(
  'chk_privacy_settings_selection',
  "(sharing_mode = 'selected_friends' AND cardinality(selected_friend_ids) BETWEEN 1 AND 100) OR (sharing_mode <> 'selected_friends' AND cardinality(selected_friend_ids) = 0)",
)
@Check(
  'chk_privacy_settings_no_self',
  'NOT (user_id = ANY(selected_friend_ids))',
)
@Check(
  'chk_privacy_settings_expiry',
  "(sharing_mode <> 'off' OR sharing_expires_at IS NULL) AND (sharing_expires_at IS NULL OR sharing_expires_at > updated_at)",
)
export class PrivacySettingsEntity {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'user_id' }) userId: string;
  @Column('varchar', { name: 'sharing_mode', length: 30, default: 'off' })
  sharingMode: SharingMode;
  @Column('boolean', { name: 'is_location_sharing_enabled', default: false })
  isLocationSharingEnabled: boolean;
  @Column('timestamptz', { name: 'sharing_expires_at', nullable: true })
  sharingExpiresAt: Date | null;
  @Column('boolean', { name: 'use_approximate_location', default: false })
  useApproximateLocation: boolean;
  @Column('boolean', { name: 'nearby_feature_enabled', default: false })
  nearbyFeatureEnabled: boolean;
  @Column('uuid', {
    name: 'selected_friend_ids',
    array: true,
    default: () => "'{}'::uuid[]",
  })
  selectedFriendIds: string[];
  @Column('timestamptz', { name: 'updated_at' }) updatedAt: Date;
}
