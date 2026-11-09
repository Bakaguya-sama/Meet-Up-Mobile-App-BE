import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Membership checks in application code are not sufficient for a concurrent
 * leave/remove operation.  PostgreSQL owns the final authorization decision
 * immediately before a chat row is inserted.
 */
export class EnforceMeetupChatAccess1792150000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION assert_meetup_chat_sender_active()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM meetup_sessions meetup
          INNER JOIN meetup_participants participant
            ON participant.meetup_id = meetup.id
           AND participant.user_id = NEW.sender_user_id
          WHERE meetup.id = NEW.meetup_id
            AND meetup.status IN ('inviting', 'choosing', 'selected')
            AND participant.status = 'accepted'
        ) THEN
          RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'CHAT_SENDER_NOT_ACTIVE';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_meetup_chat_sender_active
      BEFORE INSERT ON meetup_chat_messages
      FOR EACH ROW
      EXECUTE FUNCTION assert_meetup_chat_sender_active();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_meetup_chat_sender_active ON meetup_chat_messages;
      DROP FUNCTION IF EXISTS assert_meetup_chat_sender_active();
    `);
  }
}
