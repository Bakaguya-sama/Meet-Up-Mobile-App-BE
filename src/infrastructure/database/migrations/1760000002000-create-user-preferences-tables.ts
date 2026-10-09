import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserPreferencesTables1760000002000 implements MigrationInterface {
  name = 'CreateUserPreferencesTables1760000002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE preference_level AS ENUM ('high', 'normal', 'avoid');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE activity_tags (
        id smallint PRIMARY KEY,
        code varchar(50) NOT NULL UNIQUE,
        display_name varchar(100) NOT NULL,
        is_active boolean NOT NULL DEFAULT true
      );

      CREATE TABLE user_preferences (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL UNIQUE REFERENCES user_accounts(id) ON DELETE CASCADE,
        updated_at timestamptz NOT NULL
      );

      CREATE TABLE user_preference_tags (
        user_preference_id uuid NOT NULL REFERENCES user_preferences(id) ON DELETE CASCADE,
        activity_tag_id smallint NOT NULL REFERENCES activity_tags(id) ON DELETE CASCADE,
        level preference_level NOT NULL DEFAULT 'normal',
        created_at timestamptz NOT NULL,
        CONSTRAINT pk_user_preference_tags PRIMARY KEY (user_preference_id, activity_tag_id)
      );

      CREATE INDEX idx_user_preference_tags_pref_id ON user_preference_tags (user_preference_id);

      INSERT INTO activity_tags (id, code, display_name, is_active)
      VALUES
        (1, 'food', 'Ăn uống', true),
        (2, 'coffee', 'Cà phê', true),
        (3, 'movie', 'Xem phim', true),
        (4, 'mall', 'Mua sắm', true),
        (5, 'park', 'Công viên', true),
        (6, 'entertainment', 'Giải trí', true)
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS user_preference_tags;
      DROP TABLE IF EXISTS user_preferences;
      DROP TABLE IF EXISTS activity_tags;
      DROP TYPE IF EXISTS preference_level;
    `);
  }
}
