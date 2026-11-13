import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecommendationClosingSnapshots1792180000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE recommendation_runs ADD COLUMN closing_policy_version varchar(100) NOT NULL DEFAULT 'closing-policy-legacy-off'",
    );
    await queryRunner.query(
      'ALTER TABLE recommendation_candidates ADD COLUMN closing_evidence jsonb',
    );
    await queryRunner.query(
      'ALTER TABLE recommendation_places ADD COLUMN closing_evidence jsonb',
    );
    await queryRunner.query(
      'ALTER TABLE recommendation_member_features ADD COLUMN ranking_utility double precision NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE recommendation_member_features DROP CONSTRAINT chk_recommendation_member_feature_numbers',
    );
    await queryRunner.query(`
      ALTER TABLE recommendation_member_features
      ADD CONSTRAINT chk_recommendation_member_feature_numbers
      CHECK (
        eta_seconds >= 0
        AND distance_meters >= 0
        AND travel_utility BETWEEN 0 AND 1
        AND preference_utility BETWEEN 0 AND 1
        AND place_quality_utility BETWEEN 0 AND 1
        AND member_utility BETWEEN 0 AND 1
        AND ranking_utility BETWEEN 0 AND 1
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE recommendation_member_features DROP CONSTRAINT chk_recommendation_member_feature_numbers',
    );
    await queryRunner.query(
      'ALTER TABLE recommendation_member_features DROP COLUMN ranking_utility',
    );
    await queryRunner.query(`
      ALTER TABLE recommendation_member_features
      ADD CONSTRAINT chk_recommendation_member_feature_numbers
      CHECK (
        eta_seconds >= 0
        AND distance_meters >= 0
        AND travel_utility BETWEEN 0 AND 1
        AND preference_utility BETWEEN 0 AND 1
        AND place_quality_utility BETWEEN 0 AND 1
        AND member_utility BETWEEN 0 AND 1
      )
    `);
    await queryRunner.query(
      'ALTER TABLE recommendation_places DROP COLUMN closing_evidence',
    );
    await queryRunner.query(
      'ALTER TABLE recommendation_candidates DROP COLUMN closing_evidence',
    );
    await queryRunner.query(
      'ALTER TABLE recommendation_runs DROP COLUMN closing_policy_version',
    );
  }
}
