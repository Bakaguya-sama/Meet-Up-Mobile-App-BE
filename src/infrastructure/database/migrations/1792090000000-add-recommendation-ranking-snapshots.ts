import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecommendationRankingSnapshots1792090000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE recommendation_runs
        ADD COLUMN effective_k smallint,
        ADD COLUMN warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN random_seed varchar(100),
        ADD COLUMN route_batch_count integer,
        ADD COLUMN route_element_count integer,
        ADD CONSTRAINT chk_recommendation_runs_effective_k
          CHECK (effective_k IS NULL OR (effective_k > 0 AND effective_k <= requested_k)),
        ADD CONSTRAINT chk_recommendation_runs_route_counts
          CHECK (
            (route_batch_count IS NULL OR route_batch_count >= 0)
            AND (route_element_count IS NULL OR route_element_count >= 0)
          );

      ALTER TABLE recommendation_candidates
        ADD COLUMN normalized_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN rating_0_to_5 double precision,
        ADD COLUMN user_rating_count integer,
        ADD COLUMN final_rank smallint,
        ADD COLUMN group_utility double precision,
        ADD COLUMN candidate_least_misery_utility double precision,
        ADD COLUMN pareto_level integer,
        ADD COLUMN inclusion_probability double precision,
        ADD COLUMN avg_eta_seconds double precision,
        ADD COLUMN max_eta_seconds double precision,
        ADD COLUMN eta_range_seconds double precision,
        ADD CONSTRAINT chk_recommendation_candidates_rating
          CHECK (rating_0_to_5 IS NULL OR rating_0_to_5 BETWEEN 0 AND 5),
        ADD CONSTRAINT chk_recommendation_candidates_review_count
          CHECK (user_rating_count IS NULL OR user_rating_count >= 0),
        ADD CONSTRAINT chk_recommendation_candidates_ranking
          CHECK (
            (final_rank IS NULL OR final_rank > 0)
            AND (group_utility IS NULL OR group_utility BETWEEN 0 AND 1)
            AND (
              candidate_least_misery_utility IS NULL
              OR candidate_least_misery_utility BETWEEN 0 AND 1
            )
            AND (pareto_level IS NULL OR pareto_level > 0)
            AND (
              inclusion_probability IS NULL
              OR inclusion_probability BETWEEN 0 AND 1
            )
            AND (avg_eta_seconds IS NULL OR avg_eta_seconds >= 0)
            AND (max_eta_seconds IS NULL OR max_eta_seconds >= 0)
            AND (eta_range_seconds IS NULL OR eta_range_seconds >= 0)
          );

      CREATE UNIQUE INDEX uq_recommendation_candidates_run_rank
        ON recommendation_candidates (run_id, final_rank)
        WHERE final_rank IS NOT NULL;

      CREATE TABLE recommendation_member_features (
        id uuid PRIMARY KEY,
        run_id uuid NOT NULL
          CONSTRAINT recommendation_member_features_run_id_fkey
          REFERENCES recommendation_runs(id) ON DELETE CASCADE,
        candidate_id uuid NOT NULL
          CONSTRAINT recommendation_member_features_candidate_id_fkey
          REFERENCES recommendation_candidates(id) ON DELETE CASCADE,
        participant_id uuid NOT NULL
          CONSTRAINT recommendation_member_features_participant_id_fkey
          REFERENCES meetup_participants(id),
        canonical_candidate_key varchar(300) NOT NULL,
        eta_seconds double precision NOT NULL,
        distance_meters double precision NOT NULL,
        matched_tags jsonb NOT NULL,
        missing_flags jsonb NOT NULL,
        travel_utility double precision NOT NULL,
        preference_utility double precision NOT NULL,
        place_quality_utility double precision NOT NULL,
        member_utility double precision NOT NULL,
        route_status varchar(20) NOT NULL,
        created_at timestamptz NOT NULL,
        CONSTRAINT uq_recommendation_member_feature
          UNIQUE (run_id, participant_id, canonical_candidate_key),
        CONSTRAINT chk_recommendation_member_feature_route
          CHECK (route_status = 'OK'),
        CONSTRAINT chk_recommendation_member_feature_numbers
          CHECK (
            eta_seconds >= 0
            AND distance_meters >= 0
            AND travel_utility BETWEEN 0 AND 1
            AND preference_utility BETWEEN 0 AND 1
            AND place_quality_utility BETWEEN 0 AND 1
            AND member_utility BETWEEN 0 AND 1
          )
      );
      CREATE INDEX idx_recommendation_member_features_run_candidate
        ON recommendation_member_features (run_id, candidate_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE recommendation_member_features');
    await queryRunner.query('DROP INDEX uq_recommendation_candidates_run_rank');
    await queryRunner.query(`
      ALTER TABLE recommendation_candidates
        DROP CONSTRAINT chk_recommendation_candidates_ranking,
        DROP CONSTRAINT chk_recommendation_candidates_review_count,
        DROP CONSTRAINT chk_recommendation_candidates_rating,
        DROP COLUMN eta_range_seconds,
        DROP COLUMN max_eta_seconds,
        DROP COLUMN avg_eta_seconds,
        DROP COLUMN inclusion_probability,
        DROP COLUMN pareto_level,
        DROP COLUMN candidate_least_misery_utility,
        DROP COLUMN group_utility,
        DROP COLUMN final_rank,
        DROP COLUMN user_rating_count,
        DROP COLUMN rating_0_to_5,
        DROP COLUMN normalized_tags;

      ALTER TABLE recommendation_runs
        DROP CONSTRAINT chk_recommendation_runs_route_counts,
        DROP CONSTRAINT chk_recommendation_runs_effective_k,
        DROP COLUMN route_element_count,
        DROP COLUMN route_batch_count,
        DROP COLUMN random_seed,
        DROP COLUMN warnings,
        DROP COLUMN effective_k;
    `);
  }
}
