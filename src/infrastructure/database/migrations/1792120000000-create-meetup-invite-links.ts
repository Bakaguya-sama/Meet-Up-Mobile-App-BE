import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMeetupInviteLinks1792120000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE meetup_invite_links (
        id uuid PRIMARY KEY,
        meetup_id uuid NOT NULL REFERENCES meetup_sessions(id) ON DELETE CASCADE,
        created_by_id uuid NOT NULL REFERENCES user_accounts(id),
        token_hash char(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        revoked_by_id uuid REFERENCES user_accounts(id),
        use_count integer NOT NULL DEFAULT 0,
        last_used_at timestamptz,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT uq_meetup_invite_links_token_hash UNIQUE (token_hash),
        CONSTRAINT chk_meetup_invite_links_use_count CHECK (use_count >= 0)
      );
      CREATE INDEX idx_meetup_invite_links_meetup_revoked
        ON meetup_invite_links (meetup_id, revoked_at);
      CREATE INDEX idx_meetup_invite_links_expires_at
        ON meetup_invite_links (expires_at);
      CREATE INDEX idx_meetup_invite_links_creator_created
        ON meetup_invite_links (created_by_id, created_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE meetup_invite_links');
  }
}
