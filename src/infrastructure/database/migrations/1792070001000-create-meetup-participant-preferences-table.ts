import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMeetupParticipantPreferencesTable1792070001000 implements MigrationInterface {
  name = 'CreateMeetupParticipantPreferencesTable1792070001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE meetup_participant_preferences (
        meetup_participant_id uuid NOT NULL REFERENCES meetup_participants(id) ON DELETE CASCADE,
        activity_tag_id smallint NOT NULL REFERENCES activity_tags(id) ON DELETE CASCADE,
        level preference_level NOT NULL DEFAULT 'normal',
        source varchar(30) NOT NULL DEFAULT 'meetup_input',
        updated_at timestamptz NOT NULL,
        CONSTRAINT pk_meetup_participant_preferences PRIMARY KEY (meetup_participant_id, activity_tag_id),
        CONSTRAINT chk_preference_source CHECK (source IN ('meetup_input', 'profile_fallback'))
      );

      CREATE INDEX idx_meetup_participant_preferences_participant_id
        ON meetup_participant_preferences (meetup_participant_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS meetup_participant_preferences;
    `);
  }
}
