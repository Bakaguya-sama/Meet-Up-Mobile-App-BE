import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMeetupVoting1792150000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE recommendation_runs
        ADD CONSTRAINT uq_recommendation_runs_meetup_id_id
        UNIQUE (meetup_id, id);
      ALTER TABLE recommendation_places
        ADD CONSTRAINT uq_recommendation_places_id_run
        UNIQUE (id, run_id);
      ALTER TABLE meetup_participants
        ADD CONSTRAINT uq_meetup_participants_meetup_id_id
        UNIQUE (meetup_id, id);

      ALTER TABLE meetup_sessions
        ADD COLUMN vote_deadline_at timestamptz,
        ADD COLUMN chosen_recommendation_place_id uuid,
        ADD COLUMN chosen_run_id uuid,
        ADD COLUMN chosen_by_id uuid REFERENCES user_accounts(id),
        ADD COLUMN chosen_at timestamptz,
        ADD CONSTRAINT chk_meetups_vote_deadline
          CHECK (vote_deadline_at IS NULL OR vote_deadline_at <= scheduled_at),
        ADD CONSTRAINT chk_meetups_finalized_fields
          CHECK (
            (
              chosen_recommendation_place_id IS NOT NULL AND
              chosen_run_id IS NOT NULL AND
              chosen_by_id IS NOT NULL AND
              chosen_at IS NOT NULL
            ) OR (
              chosen_recommendation_place_id IS NULL AND
              chosen_run_id IS NULL AND
              chosen_by_id IS NULL AND
              chosen_at IS NULL
            )
          ),
        ADD CONSTRAINT chk_meetups_selected_has_place
          CHECK (
            status <> 'selected' OR
            chosen_recommendation_place_id IS NOT NULL
          ),
        ADD CONSTRAINT fk_meetups_chosen_run
          FOREIGN KEY (id, chosen_run_id)
          REFERENCES recommendation_runs (meetup_id, id),
        ADD CONSTRAINT fk_meetups_chosen_place
          FOREIGN KEY (chosen_recommendation_place_id, chosen_run_id)
          REFERENCES recommendation_places (id, run_id);

      CREATE TABLE votes (
        id uuid PRIMARY KEY,
        meetup_id uuid NOT NULL,
        run_id uuid NOT NULL,
        recommendation_place_id uuid NOT NULL,
        meetup_participant_id uuid NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT uq_votes_meetup_participant UNIQUE (meetup_id, meetup_participant_id),
        CONSTRAINT fk_votes_meetup_run
          FOREIGN KEY (meetup_id, run_id)
          REFERENCES recommendation_runs (meetup_id, id) ON DELETE CASCADE,
        CONSTRAINT fk_votes_recommendation_place
          FOREIGN KEY (recommendation_place_id, run_id)
          REFERENCES recommendation_places (id, run_id) ON DELETE CASCADE,
        CONSTRAINT fk_votes_meetup_participant
          FOREIGN KEY (meetup_id, meetup_participant_id)
          REFERENCES meetup_participants (meetup_id, id) ON DELETE CASCADE
      );
      CREATE INDEX idx_votes_recommendation_place ON votes (recommendation_place_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE votes;
      ALTER TABLE meetup_sessions
        DROP CONSTRAINT fk_meetups_chosen_place,
        DROP CONSTRAINT fk_meetups_chosen_run,
        DROP CONSTRAINT chk_meetups_finalized_fields,
        DROP CONSTRAINT chk_meetups_vote_deadline,
        DROP COLUMN chosen_at,
        DROP COLUMN chosen_by_id,
        DROP COLUMN chosen_run_id,
        DROP COLUMN chosen_recommendation_place_id,
        DROP COLUMN vote_deadline_at;
      ALTER TABLE meetup_participants
        DROP CONSTRAINT uq_meetup_participants_meetup_id_id;
      ALTER TABLE recommendation_places
        DROP CONSTRAINT uq_recommendation_places_id_run;
      ALTER TABLE recommendation_runs
        DROP CONSTRAINT uq_recommendation_runs_meetup_id_id;
    `);
  }
}
