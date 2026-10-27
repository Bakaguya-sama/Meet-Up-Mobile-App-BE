import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { UserAccountEntity } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/entities/user-account.typeorm-entity';
import { MeetupEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/meetup.typeorm-entity';
import { ParticipantEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/participant.typeorm-entity';
import type { RecommendationRun } from '../src/bounded-contexts/recommendations/domain/recommendation-run';
import { RecommendationCandidateEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-candidate.typeorm-entity';
import { RecommendationRunEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-run.typeorm-entity';
import { TypeOrmRecommendationRunRepository } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/typeorm-recommendation-run.repository';
import { CreateAuthTables1760000001000 } from '../src/infrastructure/database/migrations/1760000001000-create-auth-tables';
import { CreateMeetupsTables1792070000000 } from '../src/infrastructure/database/migrations/1792070000000-create-meetups-tables';
import { CreateRecommendationRunBaseline1792080000000 } from '../src/infrastructure/database/migrations/1792080000000-create-recommendation-run-baseline';

const databaseUrl = process.env.MEETUP_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'MEETUP_TEST_DATABASE_URL is required for recommendation integration tests',
  );
}

describe('Recommendation PostgreSQL repository and migration cycle', () => {
  const schema = `recommendation_test_${randomUUID().replaceAll('-', '')}`;
  const actorId = randomUUID();
  const meetupId = randomUUID();
  let bootstrap: DataSource;
  let db: DataSource;
  let repository: TypeOrmRecommendationRunRepository;

  beforeAll(async () => {
    bootstrap = await new DataSource({
      type: 'postgres',
      url: databaseUrl,
      ssl: databaseUrl?.includes('sslmode=require'),
    }).initialize();
    await bootstrap.query(`CREATE SCHEMA "${schema}"`);
    db = await new DataSource({
      type: 'postgres',
      url: databaseUrl,
      schema,
      extra: { options: `-c search_path=${schema},public` },
      ssl: databaseUrl?.includes('sslmode=require'),
      synchronize: false,
      entities: [
        UserAccountEntity,
        MeetupEntity,
        ParticipantEntity,
        RecommendationRunEntity,
        RecommendationCandidateEntity,
      ],
      migrations: [
        CreateAuthTables1760000001000,
        CreateMeetupsTables1792070000000,
        CreateRecommendationRunBaseline1792080000000,
      ],
    }).initialize();

    await db.runMigrations();
    const columns = await db.query<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name IN ('recommendation_runs', 'recommendation_candidates')`,
      [schema],
    );
    expect(columns.map((row) => row.column_name)).toEqual(
      expect.arrayContaining([
        'request_id',
        'payload_hash',
        'provider_mapping_version',
        'provider_types',
        'source_pages',
      ]),
    );
    await db.undoLastMigration();
    expect(
      await db.query(`SELECT to_regclass($1) AS name`, [
        `${schema}.recommendation_runs`,
      ]),
    ).toEqual([{ name: null }]);
    await db.runMigrations();

    await db.query(
      `INSERT INTO user_accounts (id, email, display_name, created_at, updated_at) VALUES ($1, $2, 'Actor', NOW(), NOW())`,
      [actorId, `${actorId}@test.invalid`],
    );
    await db.query(
      `INSERT INTO meetup_sessions (id, organizer_id, title, scheduled_at, invitation_deadline_at, search_radius_m, place_type, recommendation_mode, status, created_at, updated_at) VALUES ($1, $2, 'Test', NOW() + interval '2 hours', NOW() + interval '1 hour', 1000, 'cafe', 'balanced', 'inviting', NOW(), NOW())`,
      [meetupId, actorId],
    );
    repository = new TypeOrmRecommendationRunRepository(db);
  });

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (bootstrap?.isInitialized) {
      await bootstrap.query(`DROP SCHEMA "${schema}" CASCADE`);
      await bootstrap.destroy();
    }
  });

  function run(overrides: Partial<RecommendationRun> = {}): RecommendationRun {
    return {
      id: randomUUID(),
      meetupId,
      requestId: randomUUID(),
      payloadHash: 'a'.repeat(64),
      requestedById: actorId,
      requestedK: 3,
      status: 'RUNNING',
      failureCode: null,
      rankingStrategy: 'fair-pareto-v1',
      algorithmVersion: 'recommendation-engine-v1',
      configVersion: 'recommendation-config-dev-v1',
      featureSchemaVersion: 'recommendation-features-v1',
      providerMappingVersion: 'google-place-category-map-v1',
      createdAt: new Date(),
      completedAt: null,
      ...overrides,
    };
  }

  it('returns null for empty reads and returns the same row for a duplicate key', async () => {
    expect(await repository.findByRequest(meetupId, randomUUID())).toBeNull();
    const first = run();
    await expect(repository.create(first)).resolves.toMatchObject({
      id: first.id,
    });
    await expect(
      repository.create({ ...first, id: randomUUID() }),
    ).resolves.toMatchObject({ id: first.id });
  });

  it('commits candidates atomically and enforces database constraints', async () => {
    const invalid = run();
    await repository.create(invalid);
    await expect(
      repository.complete(
        invalid.id,
        [
          {
            id: randomUUID(),
            runId: invalid.id,
            canonicalCandidateKey: 'google-places:invalid',
            provider: 'google-places',
            providerPlaceId: 'invalid',
            name: 'Invalid',
            latitude: 91,
            longitude: 106.7,
            providerTypes: ['cafe'],
            sourceCategories: ['cafe'],
            sourcePages: [1],
            filterStatus: 'ELIGIBLE',
            filterReason: null,
            createdAt: new Date(),
          },
        ],
        new Date(),
      ),
    ).rejects.toMatchObject({ driverError: { code: '23514' } });
    await expect(
      repository.findById(meetupId, invalid.id),
    ).resolves.toMatchObject({
      status: 'RUNNING',
      candidates: [],
    });

    const valid = run();
    await repository.create(valid);
    const completed = await repository.complete(
      valid.id,
      [
        {
          id: randomUUID(),
          runId: valid.id,
          canonicalCandidateKey: 'google-places:cafe-1',
          provider: 'google-places',
          providerPlaceId: 'cafe-1',
          name: 'Cafe',
          latitude: 10.7,
          longitude: 106.7,
          providerTypes: ['cafe'],
          sourceCategories: ['cafe'],
          sourcePages: [1],
          filterStatus: 'ELIGIBLE',
          filterReason: null,
          createdAt: new Date(),
        },
      ],
      new Date(),
    );
    expect(completed).toMatchObject({ status: 'COMPLETED' });
    expect(completed.candidates).toHaveLength(1);
  });
});
