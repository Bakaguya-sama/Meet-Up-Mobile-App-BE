import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRecommendationResults1792110000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE recommendation_places (
        id uuid PRIMARY KEY,
        run_id uuid NOT NULL,
        candidate_id uuid NOT NULL,
        canonical_candidate_key varchar(300) NOT NULL,
        rank smallint NOT NULL,
        group_utility double precision NOT NULL,
        candidate_least_misery_utility double precision NOT NULL,
        pareto_level integer NOT NULL,
        inclusion_probability double precision,
        avg_eta_seconds double precision NOT NULL,
        max_eta_seconds double precision NOT NULL,
        eta_range_seconds double precision NOT NULL,
        scheduled_opening_status varchar(20),
        opening_evidence jsonb,
        explanation jsonb NOT NULL,
        created_at timestamptz NOT NULL,
        CONSTRAINT recommendation_places_run_id_fkey
          FOREIGN KEY (run_id) REFERENCES recommendation_runs(id) ON DELETE CASCADE,
        CONSTRAINT recommendation_places_candidate_id_fkey
          FOREIGN KEY (candidate_id) REFERENCES recommendation_candidates(id) ON DELETE CASCADE,
        CONSTRAINT uq_recommendation_places_candidate UNIQUE (run_id, candidate_id),
        CONSTRAINT chk_recommendation_places_metrics CHECK (
          rank > 0
          AND group_utility BETWEEN 0 AND 1
          AND candidate_least_misery_utility BETWEEN 0 AND 1
          AND pareto_level > 0
          AND (inclusion_probability IS NULL OR inclusion_probability BETWEEN 0 AND 1)
          AND avg_eta_seconds >= 0
          AND max_eta_seconds >= 0
          AND eta_range_seconds >= 0
        ),
        CONSTRAINT chk_recommendation_places_scheduled_opening CHECK (
          scheduled_opening_status IS NULL
          OR scheduled_opening_status IN ('OPEN','CLOSED','UNKNOWN')
        ),
        CONSTRAINT chk_recommendation_places_explanation CHECK (
          jsonb_typeof(explanation) = 'object'
          AND explanation ? 'summaryCode'
          AND explanation ? 'facts'
          AND jsonb_typeof(explanation->'facts') = 'array'
        )
      );

      CREATE UNIQUE INDEX uq_recommendation_places_run_rank
        ON recommendation_places(run_id, rank);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE recommendation_places');
  }
}
