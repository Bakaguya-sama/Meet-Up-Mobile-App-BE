import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRecommendationRunBaseline1792080000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE recommendation_runs (
        id uuid PRIMARY KEY,
        meetup_id uuid NOT NULL CONSTRAINT recommendation_runs_meetup_id_fkey REFERENCES meetup_sessions(id),
        request_id uuid NOT NULL,
        payload_hash char(64) NOT NULL,
        requested_by_id uuid NOT NULL CONSTRAINT recommendation_runs_requested_by_id_fkey REFERENCES user_accounts(id),
        requested_k smallint NOT NULL CONSTRAINT chk_recommendation_runs_requested_k CHECK (requested_k > 0),
        status varchar(20) NOT NULL CONSTRAINT chk_recommendation_runs_status CHECK (status IN ('RUNNING','COMPLETED','FAILED')),
        failure_code varchar(100),
        ranking_strategy varchar(50) NOT NULL,
        algorithm_version varchar(100) NOT NULL,
        config_version varchar(100) NOT NULL,
        feature_schema_version varchar(100) NOT NULL,
        provider_mapping_version varchar(100) NOT NULL,
        created_at timestamptz NOT NULL,
        completed_at timestamptz,
        CONSTRAINT uq_recommendation_runs_request UNIQUE (meetup_id, request_id)
      );
      CREATE INDEX idx_recommendation_runs_meetup_created
        ON recommendation_runs (meetup_id, created_at);
      CREATE TABLE recommendation_candidates (
        id uuid PRIMARY KEY,
        run_id uuid NOT NULL CONSTRAINT recommendation_candidates_run_id_fkey REFERENCES recommendation_runs(id) ON DELETE CASCADE,
        canonical_candidate_key varchar(300) NOT NULL,
        provider varchar(50) NOT NULL,
        provider_place_id varchar(255) NOT NULL,
        name varchar(255) NOT NULL,
        latitude double precision NOT NULL CONSTRAINT chk_recommendation_candidates_latitude CHECK (latitude BETWEEN -90 AND 90),
        longitude double precision NOT NULL CONSTRAINT chk_recommendation_candidates_longitude CHECK (longitude BETWEEN -180 AND 180),
        provider_types jsonb NOT NULL,
        source_categories jsonb NOT NULL,
        source_pages jsonb NOT NULL,
        filter_status varchar(20) NOT NULL CONSTRAINT chk_recommendation_candidates_filter_status CHECK (filter_status IN ('ELIGIBLE','FILTERED')),
        filter_reason varchar(100),
        created_at timestamptz NOT NULL,
        CONSTRAINT uq_recommendation_candidate UNIQUE (run_id, canonical_candidate_key)
      );
      CREATE INDEX idx_recommendation_candidates_run_status
        ON recommendation_candidates (run_id, filter_status);
    `);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE recommendation_candidates');
    await queryRunner.query('DROP TABLE recommendation_runs');
  }
}
