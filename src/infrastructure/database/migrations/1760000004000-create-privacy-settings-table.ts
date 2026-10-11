import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePrivacySettingsTable1760000004000 implements MigrationInterface {
  name = 'CreatePrivacySettingsTable1760000004000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE privacy_settings (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
        sharing_mode varchar(30) NOT NULL DEFAULT 'off',
        is_location_sharing_enabled boolean NOT NULL DEFAULT false,
        sharing_expires_at timestamptz,
        use_approximate_location boolean NOT NULL DEFAULT false,
        nearby_feature_enabled boolean NOT NULL DEFAULT false,
        selected_friend_ids uuid[] NOT NULL DEFAULT '{}',
        updated_at timestamptz NOT NULL,
        CONSTRAINT uq_privacy_settings_user UNIQUE (user_id),
        CONSTRAINT chk_privacy_settings_enabled CHECK (is_location_sharing_enabled = (sharing_mode <> 'off')),
        CONSTRAINT chk_privacy_settings_mode CHECK (sharing_mode IN ('off', 'friends', 'selected_friends', 'meetup_only')),
        CONSTRAINT chk_privacy_settings_selection CHECK (
          (sharing_mode = 'selected_friends' AND cardinality(selected_friend_ids) BETWEEN 1 AND 100) OR
          (sharing_mode <> 'selected_friends' AND cardinality(selected_friend_ids) = 0)
        ),
        CONSTRAINT chk_privacy_settings_no_self CHECK (NOT (user_id = ANY(selected_friend_ids))),
        CONSTRAINT chk_privacy_settings_expiry CHECK (
          (sharing_mode <> 'off' OR sharing_expires_at IS NULL) AND
          (sharing_expires_at IS NULL OR sharing_expires_at > updated_at)
        )
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE privacy_settings');
  }
}
