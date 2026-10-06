import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnablePostgis1760000000000 implements MigrationInterface {
  name = 'EnablePostgis1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis');
  }

  public async down(): Promise<void> {
    // PostGIS can be shared by multiple tables. Do not drop it automatically.
  }
}
