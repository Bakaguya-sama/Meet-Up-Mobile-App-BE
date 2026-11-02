import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecommendationTemporalContext1792100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE recommendation_runs
        ADD COLUMN provider_request_options_version varchar(100),
        ADD COLUMN opening_filter varchar(40),
        ADD COLUMN opening_evaluator_version varchar(100),
        ADD COLUMN requested_at timestamptz,
        ADD COLUMN scheduled_at_snapshot timestamptz;

      UPDATE recommendation_runs AS run
      SET provider_request_options_version = 'legacy-pre-temporal-v1',
          opening_filter = 'ANY',
          opening_evaluator_version = 'not-applied',
          requested_at = run.created_at,
          scheduled_at_snapshot = meetup.scheduled_at,
          warnings = CASE
            WHEN run.warnings @> '["LEGACY_TEMPORAL_CONTEXT_BACKFILL"]'::jsonb
              THEN run.warnings
            ELSE run.warnings || '["LEGACY_TEMPORAL_CONTEXT_BACKFILL"]'::jsonb
          END
      FROM meetup_sessions AS meetup
      WHERE meetup.id = run.meetup_id;

      ALTER TABLE recommendation_runs
        ALTER COLUMN provider_request_options_version SET NOT NULL,
        ALTER COLUMN opening_filter SET NOT NULL,
        ALTER COLUMN opening_evaluator_version SET NOT NULL,
        ALTER COLUMN requested_at SET NOT NULL,
        ALTER COLUMN scheduled_at_snapshot SET NOT NULL,
        ADD CONSTRAINT chk_recommendation_runs_opening_filter
          CHECK (opening_filter IN ('ANY','OPEN_AT_REQUEST_TIME','OPEN_AT_SCHEDULED_TIME'));

      ALTER TABLE recommendation_candidates
        ADD COLUMN scheduled_opening_status varchar(20),
        ADD COLUMN opening_evidence jsonb,
        ADD CONSTRAINT chk_recommendation_candidates_scheduled_opening
          CHECK (
            scheduled_opening_status IS NULL
            OR scheduled_opening_status IN ('OPEN','CLOSED','UNKNOWN')
          );

    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE recommendation_candidates
        DROP CONSTRAINT chk_recommendation_candidates_scheduled_opening,
        DROP COLUMN opening_evidence,
        DROP COLUMN scheduled_opening_status;

      ALTER TABLE recommendation_runs
        DROP CONSTRAINT chk_recommendation_runs_opening_filter,
        DROP COLUMN scheduled_at_snapshot,
        DROP COLUMN requested_at,
        DROP COLUMN opening_evaluator_version,
        DROP COLUMN opening_filter,
        DROP COLUMN provider_request_options_version;
    `);
  }
}
