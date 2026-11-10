import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecommendationStaticDurationMetric1792170000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE recommendation_member_features ADD COLUMN static_duration_seconds double precision',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE recommendation_member_features DROP COLUMN static_duration_seconds',
    );
  }
}
