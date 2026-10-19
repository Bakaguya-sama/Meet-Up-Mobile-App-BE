import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOauthIdentitiesTable1760000005000 implements MigrationInterface {
  name = 'CreateOauthIdentitiesTable1760000005000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE oauth_identities (
        id uuid PRIMARY KEY,
        user_account_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
        provider varchar(30) NOT NULL DEFAULT 'google',
        provider_account_id varchar(255) NOT NULL,
        provider_email varchar(255),
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT uq_oauth_identities_provider_account UNIQUE (provider, provider_account_id),
        CONSTRAINT uq_oauth_identities_account_provider UNIQUE (user_account_id, provider)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE oauth_identities');
  }
}
