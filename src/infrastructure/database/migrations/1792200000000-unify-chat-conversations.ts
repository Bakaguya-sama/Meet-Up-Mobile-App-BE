import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The project is still on a fresh, non-production database. This migration
 * deliberately replaces the two provisional chat schemas without backfill.
 * Public HTTP routes remain unchanged.
 */
export class UnifyChatConversations1792200000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_direct_chat_sender_is_accepted_friend ON direct_chat_messages;
      DROP FUNCTION IF EXISTS assert_direct_chat_sender_is_accepted_friend();
      DROP TRIGGER IF EXISTS trg_meetup_chat_sender_active ON meetup_chat_messages;
      DROP FUNCTION IF EXISTS assert_meetup_chat_sender_active();
      DROP TABLE IF EXISTS direct_chat_messages;
      DROP TABLE IF EXISTS direct_chat_conversations;
      DROP TABLE IF EXISTS meetup_chat_messages;

      CREATE TABLE chat_conversations (
        id uuid PRIMARY KEY,
        type varchar(20) NOT NULL,
        meetup_id uuid REFERENCES meetup_sessions(id) ON DELETE RESTRICT,
        direct_user_a_id uuid REFERENCES user_accounts(id) ON DELETE RESTRICT,
        direct_user_b_id uuid REFERENCES user_accounts(id) ON DELETE RESTRICT,
        last_message_id uuid,
        last_message_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_chat_conversation_shape CHECK (
          (
            type = 'direct'
            AND meetup_id IS NULL
            AND direct_user_a_id IS NOT NULL
            AND direct_user_b_id IS NOT NULL
            AND direct_user_a_id < direct_user_b_id
          ) OR (
            type = 'meetup'
            AND meetup_id IS NOT NULL
            AND direct_user_a_id IS NULL
            AND direct_user_b_id IS NULL
          )
        ),
        CONSTRAINT chk_chat_last_message_pair CHECK (
          (last_message_id IS NULL) = (last_message_at IS NULL)
        )
      );
      CREATE UNIQUE INDEX uq_chat_conversations_meetup
        ON chat_conversations(meetup_id) WHERE type = 'meetup';
      CREATE UNIQUE INDEX uq_chat_conversations_direct_pair
        ON chat_conversations(direct_user_a_id, direct_user_b_id)
        WHERE type = 'direct';
      CREATE INDEX idx_chat_conversations_last_message
        ON chat_conversations(last_message_at DESC, id DESC)
        WHERE last_message_at IS NOT NULL;

      CREATE TABLE chat_conversation_members (
        conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE RESTRICT,
        user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
        joined_at timestamptz NOT NULL,
        left_at timestamptz,
        history_visible_until timestamptz,
        last_read_message_id uuid,
        last_read_at timestamptz,
        PRIMARY KEY (conversation_id, user_id),
        CONSTRAINT chk_chat_member_history CHECK (
          (left_at IS NULL AND history_visible_until IS NULL)
          OR (left_at IS NOT NULL AND history_visible_until = left_at)
        ),
        CONSTRAINT chk_chat_member_dates CHECK (
          left_at IS NULL OR joined_at <= left_at
        ),
        CONSTRAINT chk_chat_member_read_pair CHECK (
          (last_read_message_id IS NULL) = (last_read_at IS NULL)
        )
      );
      CREATE INDEX idx_chat_conversation_members_user
        ON chat_conversation_members(user_id, left_at, conversation_id);

      CREATE TABLE chat_messages (
        id uuid PRIMARY KEY,
        conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE RESTRICT,
        sender_user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
        client_message_id uuid NOT NULL,
        text_content varchar(2000) NOT NULL DEFAULT '',
        sent_at timestamptz NOT NULL,
        CONSTRAINT chk_chat_message_text_length CHECK (
          length(trim(text_content)) BETWEEN 0 AND 2000
        ),
        CONSTRAINT uq_chat_messages_sender_client UNIQUE (
          conversation_id, sender_user_id, client_message_id
        )
      );
      CREATE INDEX idx_chat_messages_conversation_sent
        ON chat_messages(conversation_id, sent_at DESC, id DESC);

      CREATE TABLE chat_message_attachments (
        id uuid PRIMARY KEY,
        message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE RESTRICT,
        storage_provider varchar(30) NOT NULL,
        storage_key varchar(500) NOT NULL,
        resource_type varchar(20) NOT NULL,
        format varchar(30) NOT NULL,
        original_file_name varchar(180) NOT NULL,
        mime_type varchar(150) NOT NULL,
        bytes bigint NOT NULL,
        sort_order smallint NOT NULL,
        created_at timestamptz NOT NULL,
        CONSTRAINT chk_chat_attachment_provider CHECK (storage_provider = 'cloudinary'),
        CONSTRAINT chk_chat_attachment_resource_type CHECK (resource_type IN ('image', 'raw')),
        CONSTRAINT chk_chat_attachment_bytes CHECK (bytes BETWEEN 1 AND 10485760),
        CONSTRAINT chk_chat_attachment_order CHECK (sort_order BETWEEN 0 AND 4),
        CONSTRAINT uq_chat_message_attachments_order UNIQUE (message_id, sort_order),
        CONSTRAINT uq_chat_message_attachments_storage UNIQUE (storage_provider, storage_key)
      );
      CREATE INDEX idx_chat_message_attachments_message
        ON chat_message_attachments(message_id, sort_order);

      ALTER TABLE chat_conversations
        ADD CONSTRAINT fk_chat_conversations_last_message
        FOREIGN KEY (last_message_id) REFERENCES chat_messages(id) ON DELETE RESTRICT;
      ALTER TABLE chat_conversation_members
        ADD CONSTRAINT fk_chat_members_last_read_message
        FOREIGN KEY (last_read_message_id) REFERENCES chat_messages(id) ON DELETE RESTRICT;

      CREATE FUNCTION assert_chat_message_has_content()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF length(trim(NEW.text_content)) = 0 AND NOT EXISTS (
          SELECT 1 FROM chat_message_attachments WHERE message_id = NEW.id
        ) THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'CHAT_MESSAGE_CONTENT_REQUIRED';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE CONSTRAINT TRIGGER trg_chat_message_has_content
        AFTER INSERT OR UPDATE OF text_content ON chat_messages
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION assert_chat_message_has_content();

      CREATE FUNCTION assert_chat_attachment_delete_keeps_content()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM chat_messages
          WHERE id = OLD.message_id AND length(trim(text_content)) = 0
        ) AND NOT EXISTS (
          SELECT 1 FROM chat_message_attachments WHERE message_id = OLD.message_id
        ) THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'CHAT_MESSAGE_CONTENT_REQUIRED';
        END IF;
        RETURN OLD;
      END;
      $$;
      CREATE CONSTRAINT TRIGGER trg_chat_attachment_delete_keeps_content
        AFTER DELETE ON chat_message_attachments
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION assert_chat_attachment_delete_keeps_content();

      CREATE FUNCTION create_chat_conversation_for_meetup()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO chat_conversations(id, type, meetup_id, created_at)
        VALUES (gen_random_uuid(), 'meetup', NEW.id, NEW.created_at);
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER trg_create_chat_conversation_for_meetup
        AFTER INSERT ON meetup_sessions
        FOR EACH ROW EXECUTE FUNCTION create_chat_conversation_for_meetup();

      CREATE FUNCTION sync_meetup_chat_member()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE target_conversation_id uuid;
      BEGIN
        SELECT id INTO target_conversation_id
        FROM chat_conversations
        WHERE type = 'meetup' AND meetup_id = NEW.meetup_id;

        IF NEW.status = 'accepted' THEN
          INSERT INTO chat_conversation_members(
            conversation_id, user_id, joined_at, left_at, history_visible_until
          ) VALUES (
            target_conversation_id, NEW.user_id, COALESCE(NEW.joined_at, now()), NULL, NULL
          )
          ON CONFLICT (conversation_id, user_id) DO UPDATE SET
            joined_at = LEAST(chat_conversation_members.joined_at, EXCLUDED.joined_at),
            left_at = NULL,
            history_visible_until = NULL;
        ELSIF NEW.status IN ('left', 'removed') AND NEW.left_at IS NOT NULL THEN
          UPDATE chat_conversation_members
          SET left_at = NEW.left_at, history_visible_until = NEW.left_at
          WHERE conversation_id = target_conversation_id AND user_id = NEW.user_id;
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER trg_sync_meetup_chat_member
        AFTER INSERT OR UPDATE OF status, joined_at, left_at ON meetup_participants
        FOR EACH ROW EXECUTE FUNCTION sync_meetup_chat_member();

      CREATE FUNCTION assert_chat_sender_can_send()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE conversation chat_conversations%ROWTYPE;
      BEGIN
        SELECT * INTO conversation FROM chat_conversations
        WHERE id = NEW.conversation_id FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_FORBIDDEN';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM chat_conversation_members
          WHERE conversation_id = NEW.conversation_id
            AND user_id = NEW.sender_user_id
            AND left_at IS NULL
        ) THEN
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_FORBIDDEN';
        END IF;

        IF conversation.type = 'direct' THEN
          PERFORM 1 FROM friendships
          WHERE user_a_id = conversation.direct_user_a_id
            AND user_b_id = conversation.direct_user_b_id
            AND status = 'accepted'
          FOR UPDATE;
          IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DIRECT_CHAT_FORBIDDEN';
          END IF;
        ELSE
          PERFORM 1 FROM meetup_sessions
          WHERE id = conversation.meetup_id
            AND status IN ('inviting', 'choosing', 'selected')
          FOR UPDATE;
          IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_SENDER_NOT_ACTIVE';
          END IF;
          PERFORM 1 FROM meetup_participants
          WHERE meetup_id = conversation.meetup_id
            AND user_id = NEW.sender_user_id
            AND status = 'accepted'
          FOR UPDATE;
          IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_SENDER_NOT_ACTIVE';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER trg_chat_sender_can_send
        BEFORE INSERT ON chat_messages
        FOR EACH ROW EXECUTE FUNCTION assert_chat_sender_can_send();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_chat_sender_can_send ON chat_messages;
      DROP FUNCTION IF EXISTS assert_chat_sender_can_send();
      DROP TRIGGER IF EXISTS trg_sync_meetup_chat_member ON meetup_participants;
      DROP FUNCTION IF EXISTS sync_meetup_chat_member();
      DROP TRIGGER IF EXISTS trg_create_chat_conversation_for_meetup ON meetup_sessions;
      DROP FUNCTION IF EXISTS create_chat_conversation_for_meetup();
      DROP TRIGGER IF EXISTS trg_chat_attachment_delete_keeps_content ON chat_message_attachments;
      DROP FUNCTION IF EXISTS assert_chat_attachment_delete_keeps_content();
      DROP TRIGGER IF EXISTS trg_chat_message_has_content ON chat_messages;
      DROP FUNCTION IF EXISTS assert_chat_message_has_content();
      DROP TABLE chat_message_attachments;
      DROP TABLE chat_conversation_members;
      ALTER TABLE chat_conversations DROP CONSTRAINT fk_chat_conversations_last_message;
      DROP TABLE chat_messages;
      DROP TABLE chat_conversations;

      CREATE TABLE meetup_chat_messages (
        id uuid PRIMARY KEY,
        meetup_id uuid NOT NULL REFERENCES meetup_sessions(id) ON DELETE CASCADE,
        sender_user_id uuid NOT NULL REFERENCES user_accounts(id),
        text_content varchar(2000) NOT NULL,
        attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
        sent_at timestamptz NOT NULL,
        CONSTRAINT chk_meetup_chat_message_content CHECK (
          (length(trim(text_content)) BETWEEN 1 AND 2000)
          OR (length(trim(text_content)) = 0 AND jsonb_array_length(attachments) > 0)
        )
      );
      CREATE INDEX idx_meetup_chat_messages_meetup_sent
        ON meetup_chat_messages(meetup_id, sent_at, id);

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
        ON direct_chat_messages(conversation_id, sent_at, id);

      CREATE FUNCTION assert_meetup_chat_sender_active()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM meetup_sessions meetup
          INNER JOIN meetup_participants participant
            ON participant.meetup_id = meetup.id
           AND participant.user_id = NEW.sender_user_id
          WHERE meetup.id = NEW.meetup_id
            AND meetup.status IN ('inviting', 'choosing', 'selected')
            AND participant.status = 'accepted'
        ) THEN
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_SENDER_NOT_ACTIVE';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER trg_meetup_chat_sender_active
        BEFORE INSERT ON meetup_chat_messages
        FOR EACH ROW EXECUTE FUNCTION assert_meetup_chat_sender_active();

      CREATE FUNCTION assert_direct_chat_sender_is_accepted_friend()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE conversation direct_chat_conversations%ROWTYPE;
              friendship friendships%ROWTYPE;
      BEGIN
        SELECT * INTO conversation FROM direct_chat_conversations
        WHERE id = NEW.conversation_id;
        IF NOT FOUND OR NEW.sender_user_id NOT IN (conversation.user_a_id, conversation.user_b_id) THEN
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DIRECT_CHAT_FORBIDDEN';
        END IF;
        SELECT * INTO friendship FROM friendships
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
}
