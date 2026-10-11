import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFriendshipsTable1760000003000 implements MigrationInterface {
  name = 'CreateFriendshipsTable1760000003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'rejected', 'blocked');
      CREATE TABLE friendships (
        id uuid PRIMARY KEY,
        user_a_id uuid NOT NULL REFERENCES user_accounts(id),
        user_b_id uuid NOT NULL REFERENCES user_accounts(id),
        requested_by_id uuid NOT NULL REFERENCES user_accounts(id),
        status friendship_status NOT NULL DEFAULT 'pending',
        requested_at timestamptz NOT NULL,
        responded_at timestamptz,
        updated_at timestamptz NOT NULL,
        CONSTRAINT chk_friendships_sorted_pair CHECK (user_a_id < user_b_id),
        CONSTRAINT chk_friendships_requester CHECK (requested_by_id IN (user_a_id, user_b_id)),
        CONSTRAINT chk_friendships_response CHECK (
          (status = 'pending' AND responded_at IS NULL) OR
          (status <> 'pending' AND responded_at IS NOT NULL)
        ),
        CONSTRAINT uq_friendships_pair UNIQUE (user_a_id, user_b_id)
      );
      CREATE INDEX idx_friendships_a_status ON friendships (user_a_id, status);
      CREATE INDEX idx_friendships_b_status ON friendships (user_b_id, status);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TABLE friendships; DROP TYPE friendship_status;',
    );
  }
}
