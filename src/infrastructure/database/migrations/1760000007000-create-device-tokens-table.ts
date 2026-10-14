import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeviceTokensTable1760000007000 implements MigrationInterface {
  name = 'CreateDeviceTokensTable1760000007000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE device_tokens (
        id uuid PRIMARY KEY,
        user_account_id uuid NOT NULL,
        token_ciphertext text NOT NULL,
        token_fingerprint char(64) NOT NULL,
        platform varchar(10) NOT NULL,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT uq_device_tokens_fingerprint UNIQUE (token_fingerprint),
        CONSTRAINT chk_device_tokens_platform CHECK (platform IN ('android', 'ios')),
        CONSTRAINT device_tokens_user_account_id_fkey
          FOREIGN KEY (user_account_id) REFERENCES user_accounts(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_device_tokens_user_active
        ON device_tokens (user_account_id, revoked_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE device_tokens');
  }
}
