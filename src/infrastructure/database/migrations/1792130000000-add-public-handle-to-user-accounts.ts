import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPublicHandleToUserAccounts1792130000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE user_accounts
        ADD COLUMN public_handle varchar(128),
        ADD COLUMN public_handle_disabled_at timestamptz;

      CREATE UNIQUE INDEX uq_user_accounts_public_handle
        ON user_accounts (public_handle);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX uq_user_accounts_public_handle;
      ALTER TABLE user_accounts
        DROP COLUMN public_handle_disabled_at,
        DROP COLUMN public_handle;
    `);
  }
}
