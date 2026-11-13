import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRecommendationFeedbackEvents1792210000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE recommendation_impressions (
        event_id uuid PRIMARY KEY,
        run_id uuid NOT NULL REFERENCES recommendation_runs(id) ON DELETE CASCADE,
        meetup_participant_id uuid NOT NULL REFERENCES meetup_participants(id) ON DELETE RESTRICT,
        canonical_candidate_key varchar(300) NOT NULL,
        rank smallint NOT NULL CHECK (rank > 0),
        payload_hash char(64) NOT NULL,
        shown_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_recommendation_impression_candidate
          FOREIGN KEY (run_id, canonical_candidate_key)
          REFERENCES recommendation_candidates(run_id, canonical_candidate_key)
          ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX uq_recommendation_impression_run_participant_candidate
        ON recommendation_impressions(run_id, meetup_participant_id, canonical_candidate_key);
      CREATE INDEX idx_recommendation_impressions_run_participant
        ON recommendation_impressions(run_id, meetup_participant_id);

      CREATE TABLE recommendation_feedback_events (
        event_id uuid PRIMARY KEY,
        run_id uuid NOT NULL REFERENCES recommendation_runs(id) ON DELETE CASCADE,
        meetup_participant_id uuid REFERENCES meetup_participants(id) ON DELETE RESTRICT,
        event_type varchar(30) NOT NULL CHECK (event_type IN (
          'PLACE_VOTED', 'VOTE_CHANGED', 'MEETUP_PLACE_SELECTED',
          'NAVIGATION_OPENED', 'FAVORITE_ADDED', 'MEETUP_COMPLETED'
        )),
        canonical_candidate_key varchar(300),
        from_canonical_candidate_key varchar(300),
        payload_hash char(64) NOT NULL,
        occurred_at timestamptz NOT NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_recommendation_feedback_candidate
          FOREIGN KEY (run_id, canonical_candidate_key)
          REFERENCES recommendation_candidates(run_id, canonical_candidate_key)
          ON DELETE CASCADE,
        CONSTRAINT fk_recommendation_feedback_from_candidate
          FOREIGN KEY (run_id, from_canonical_candidate_key)
          REFERENCES recommendation_candidates(run_id, canonical_candidate_key)
          ON DELETE CASCADE
      );
      CREATE INDEX idx_recommendation_feedback_run_participant
        ON recommendation_feedback_events(run_id, meetup_participant_id, occurred_at);
      CREATE INDEX idx_recommendation_feedback_run_type
        ON recommendation_feedback_events(run_id, event_type, occurred_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE recommendation_feedback_events');
    await queryRunner.query('DROP TABLE recommendation_impressions');
  }
}
