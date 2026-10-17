import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMeetupsTables1792070000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE meetup_status AS ENUM ('draft', 'inviting', 'choosing', 'selected', 'cancelled', 'finished');
      CREATE TYPE meetup_member_status AS ENUM ('invited', 'accepted', 'declined', 'left', 'removed');
      CREATE TABLE meetup_sessions (
        id uuid PRIMARY KEY,
        organizer_id uuid NOT NULL REFERENCES user_accounts(id),
        title varchar(150) NOT NULL,
        description varchar(1000),
        scheduled_at timestamptz NOT NULL,
        invitation_deadline_at timestamptz NOT NULL,
        search_radius_m integer NOT NULL,
        place_type varchar(100) NOT NULL,
        recommendation_mode varchar(30) NOT NULL DEFAULT 'balanced',
        status meetup_status NOT NULL DEFAULT 'inviting',
        cancelled_at timestamptz,
        finished_at timestamptz,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT chk_meetups_radius CHECK (search_radius_m BETWEEN 100 AND 50000),
        CONSTRAINT chk_meetups_deadline CHECK (invitation_deadline_at <= scheduled_at),
        CONSTRAINT chk_meetups_mode CHECK (recommendation_mode = 'balanced'),
        CONSTRAINT chk_meetups_closed_at CHECK (
          (status = 'cancelled') = (cancelled_at IS NOT NULL) AND
          (status = 'finished') = (finished_at IS NOT NULL)
        )
      );
      CREATE INDEX idx_meetups_organizer_status ON meetup_sessions (organizer_id, status);
      CREATE INDEX idx_meetups_schedule_status ON meetup_sessions (scheduled_at, status);
      CREATE TABLE meetup_participants (
        id uuid PRIMARY KEY,
        meetup_id uuid NOT NULL REFERENCES meetup_sessions(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES user_accounts(id),
        status meetup_member_status NOT NULL DEFAULT 'invited',
        invited_by_id uuid NOT NULL REFERENCES user_accounts(id),
        responded_at timestamptz,
        joined_at timestamptz,
        left_at timestamptz,
        CONSTRAINT uq_meetup_participants_user UNIQUE (meetup_id, user_id),
        CONSTRAINT chk_participants_dates CHECK (
          (status <> 'invited' OR (responded_at IS NULL AND joined_at IS NULL AND left_at IS NULL)) AND
          (status <> 'accepted' OR (responded_at IS NOT NULL AND joined_at IS NOT NULL AND left_at IS NULL)) AND
          (status <> 'declined' OR (responded_at IS NOT NULL AND joined_at IS NULL AND left_at IS NULL)) AND
          (status NOT IN ('left','removed') OR left_at IS NOT NULL) AND
          (status <> 'left' OR joined_at IS NOT NULL)
        )
      );
      CREATE INDEX idx_meetup_participants_user_status ON meetup_participants (user_id, status);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE meetup_participants;
      DROP TABLE meetup_sessions;
      DROP TYPE meetup_member_status;
      DROP TYPE meetup_status;
    `);
  }
}
