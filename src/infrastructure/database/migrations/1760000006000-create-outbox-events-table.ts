import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOutboxEventsTable1760000006000 implements MigrationInterface {
  name = 'CreateOutboxEventsTable1760000006000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE outbox_events (
        id uuid PRIMARY KEY,
        event_name varchar(100) NOT NULL,
        destination varchar(20) NOT NULL,
        recipient_ids uuid[] NOT NULL DEFAULT '{}',
        payload jsonb NOT NULL,
        occurred_at timestamptz NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'pending',
        attempt_count integer NOT NULL DEFAULT 0,
        last_error varchar(500),
        delivered_at timestamptz,
        created_at timestamptz NOT NULL,
        CONSTRAINT chk_outbox_destination CHECK (destination IN ('realtime', 'push')),
        CONSTRAINT chk_outbox_status CHECK (status IN ('pending', 'delivered', 'failed'))
      );
      CREATE INDEX idx_outbox_events_pending ON outbox_events (status, created_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE outbox_events');
  }
}
