import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatFavoritesAndAdminAudit1792140000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE user_accounts ADD COLUMN role varchar(20) NOT NULL DEFAULT 'user';
      ALTER TABLE user_accounts ADD CONSTRAINT chk_user_accounts_role CHECK (role IN ('user','admin'));

      CREATE TABLE meetup_chat_messages (
        id uuid PRIMARY KEY,
        meetup_id uuid NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
        sender_user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
        text_content varchar(2000) NOT NULL,
        sent_at timestamptz NOT NULL,
        CONSTRAINT chk_meetup_chat_message_text CHECK (length(trim(text_content)) BETWEEN 1 AND 2000)
      );
      CREATE INDEX idx_meetup_chat_messages_meetup_sent ON meetup_chat_messages(meetup_id, sent_at, id);

      CREATE TABLE favorite_places (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
        provider varchar(50) NOT NULL,
        provider_place_id varchar(255) NOT NULL,
        canonical_candidate_key varchar(300) NOT NULL,
        place_name varchar(255) NOT NULL,
        created_at timestamptz NOT NULL,
        CONSTRAINT uq_favorite_places_user_candidate UNIQUE(user_id, canonical_candidate_key)
      );
      CREATE INDEX idx_favorite_places_user_created ON favorite_places(user_id, created_at DESC);

      CREATE TABLE audit_logs (
        id uuid PRIMARY KEY,
        actor_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
        action varchar(100) NOT NULL,
        subject_type varchar(100) NOT NULL,
        subject_id uuid NOT NULL,
        metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL
      );
      CREATE INDEX idx_audit_logs_subject_created ON audit_logs(subject_type, subject_id, created_at DESC);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE audit_logs;
      DROP TABLE favorite_places;
      DROP TABLE meetup_chat_messages;
      ALTER TABLE user_accounts DROP CONSTRAINT chk_user_accounts_role;
      ALTER TABLE user_accounts DROP COLUMN role;
    `);
  }
}
