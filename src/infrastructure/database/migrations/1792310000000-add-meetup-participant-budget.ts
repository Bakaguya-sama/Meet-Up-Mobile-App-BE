import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMeetupParticipantBudget1792310000000 implements MigrationInterface {
  name = 'AddMeetupParticipantBudget1792310000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE meetup_participants
      ADD COLUMN budget_vnd integer,
      ADD CONSTRAINT chk_meetup_participant_budget_vnd
        CHECK (budget_vnd IS NULL OR budget_vnd BETWEEN 0 AND 2147483647)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE meetup_participants
      DROP CONSTRAINT chk_meetup_participant_budget_vnd,
      DROP COLUMN budget_vnd
    `);
  }
}
