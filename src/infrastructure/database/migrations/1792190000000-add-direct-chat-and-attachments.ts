import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectChatAndAttachments1792190000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE meetup_chat_messages
        ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE meetup_chat_messages
        DROP CONSTRAINT IF EXISTS chk_meetup_chat_message_text;
      ALTER TABLE meetup_chat_messages
        ADD CONSTRAINT chk_meetup_chat_message_content CHECK (
          (length(trim(text_content)) BETWEEN 1 AND 2000)
          OR (length(trim(text_content)) = 0 AND jsonb_array_length(attachments) > 0)
        );

      CREATE TABLE direct_chat_conversations (
        id uuid PRIMARY KEY,
        user_a_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
        user_b_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_direct_chat_sorted_pair CHECK (user_a_id < user_b_id),
        CONSTRAINT uq_direct_chat_conversations_pair UNIQUE (user_a_id, user_b_id)
      );
      CREATE TABLE direct_chat_messages (
        id uuid PRIMARY KEY,
        conversation_id uuid NOT NULL REFERENCES direct_chat_conversations(id) ON DELETE CASCADE,
        sender_user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
        text_content varchar(2000) NOT NULL DEFAULT '',
        attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
        sent_at timestamptz NOT NULL,
        CONSTRAINT chk_direct_chat_message_content CHECK (
          (length(trim(text_content)) BETWEEN 1 AND 2000)
          OR (length(trim(text_content)) = 0 AND jsonb_array_length(attachments) > 0)
        )
      );
      CREATE INDEX idx_direct_chat_messages_conversation_sent
        ON direct_chat_messages (conversation_id, sent_at, id);

      CREATE FUNCTION assert_direct_chat_sender_is_accepted_friend()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE conversation direct_chat_conversations%ROWTYPE;
              friendship friendships%ROWTYPE;
      BEGIN
        SELECT * INTO conversation
        FROM direct_chat_conversations
        WHERE id = NEW.conversation_id;
        IF NOT FOUND OR NEW.sender_user_id NOT IN (conversation.user_a_id, conversation.user_b_id) THEN
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DIRECT_CHAT_FORBIDDEN';
        END IF;
        SELECT * INTO friendship
        FROM friendships
        WHERE user_a_id = conversation.user_a_id
          AND user_b_id = conversation.user_b_id
        FOR UPDATE;
        IF NOT FOUND OR friendship.status <> 'accepted' THEN
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DIRECT_CHAT_FORBIDDEN';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER trg_direct_chat_sender_is_accepted_friend
        BEFORE INSERT ON direct_chat_messages
        FOR EACH ROW EXECUTE FUNCTION assert_direct_chat_sender_is_accepted_friend();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_direct_chat_sender_is_accepted_friend ON direct_chat_messages;
      DROP FUNCTION IF EXISTS assert_direct_chat_sender_is_accepted_friend();
      DROP TABLE IF EXISTS direct_chat_messages;
      DROP TABLE IF EXISTS direct_chat_conversations;
      ALTER TABLE meetup_chat_messages DROP CONSTRAINT IF EXISTS chk_meetup_chat_message_content;
      UPDATE meetup_chat_messages SET text_content = '[attachment]'
        WHERE length(trim(text_content)) = 0;
      ALTER TABLE meetup_chat_messages DROP COLUMN IF EXISTS attachments;
      ALTER TABLE meetup_chat_messages
        ADD CONSTRAINT chk_meetup_chat_message_text
        CHECK (length(trim(text_content)) BETWEEN 1 AND 2000);
    `);
  }
}
