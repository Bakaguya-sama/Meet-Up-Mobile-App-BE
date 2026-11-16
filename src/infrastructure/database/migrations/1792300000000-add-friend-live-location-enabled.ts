import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFriendLiveLocationEnabled1792300000000 implements MigrationInterface {
  name = 'AddFriendLiveLocationEnabled1792300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE privacy_settings ADD COLUMN friend_live_location_enabled boolean NOT NULL DEFAULT false`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE privacy_settings DROP COLUMN friend_live_location_enabled`,
    );
  }
}
