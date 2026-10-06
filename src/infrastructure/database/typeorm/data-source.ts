import 'dotenv/config';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

const databaseUrl =
  process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL ?? '';

if (!databaseUrl) {
  throw new Error(
    'DATABASE_DIRECT_URL (or DATABASE_URL) is required for migration commands.',
  );
}

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [
    join(__dirname, '../../../bounded-contexts/**/*.typeorm-entity.{ts,js}'),
  ],
  migrations: [join(__dirname, '../migrations/*.{ts,js}')],
  synchronize: false,
  ssl: databaseUrl.includes('sslmode=require'),
});
