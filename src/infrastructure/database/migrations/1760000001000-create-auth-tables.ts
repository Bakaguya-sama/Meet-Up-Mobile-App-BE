import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthTables1760000001000 implements MigrationInterface {
  name = 'CreateAuthTables1760000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_accounts (
        id uuid PRIMARY KEY,
        email varchar(255) NOT NULL,
        password_hash varchar(255),
        display_name varchar(100) NOT NULL,
        avatar_url varchar(1000),
        is_locked boolean NOT NULL DEFAULT false,
        locked_reason varchar(500),
        last_login_at timestamptz,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        deleted_at timestamptz,
        CONSTRAINT chk_user_accounts_normalized_email CHECK (email = lower(trim(email)))
      );
      CREATE UNIQUE INDEX uq_user_accounts_email ON user_accounts (email);
      CREATE TABLE user_sessions (
        id uuid PRIMARY KEY,
        user_account_id uuid NOT NULL REFERENCES user_accounts(id),
        refresh_token_hash varchar(255) NOT NULL,
        refresh_token_family_id uuid NOT NULL,
        parent_session_id uuid REFERENCES user_sessions(id),
        replaced_by_session_id uuid REFERENCES user_sessions(id),
        device_name varchar(150),
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        reuse_detected_at timestamptz,
        created_at timestamptz NOT NULL
      );
      CREATE UNIQUE INDEX uq_user_sessions_token_hash ON user_sessions (refresh_token_hash);
      CREATE INDEX idx_user_sessions_account_expiry ON user_sessions (user_account_id, expires_at);
      CREATE INDEX idx_user_sessions_family ON user_sessions (refresh_token_family_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TABLE user_sessions; DROP TABLE user_accounts;',
    );
  }
}
