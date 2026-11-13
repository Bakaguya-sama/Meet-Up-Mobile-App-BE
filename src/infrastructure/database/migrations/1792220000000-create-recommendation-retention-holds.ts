import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRecommendationRetentionHolds1792220000000 implements MigrationInterface {
  name = 'CreateRecommendationRetentionHolds1792220000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE recommendation_run_holds (
        run_id uuid NOT NULL REFERENCES recommendation_runs(id) ON DELETE CASCADE,
        reason varchar(20) NOT NULL CHECK (reason IN ('replay', 'evaluation', 'export', 'legal_hold')),
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (run_id, reason)
      );
      CREATE INDEX idx_recommendation_run_holds_reason ON recommendation_run_holds(reason, run_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE recommendation_run_holds');
  }
}
