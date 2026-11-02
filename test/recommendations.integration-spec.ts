import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { UserAccountEntity } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/entities/user-account.typeorm-entity';
import { MeetupEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/meetup.typeorm-entity';
import { ParticipantEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/participant.typeorm-entity';
import { ParticipantPreferenceEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/participant-preference.typeorm-entity';
import { TypeOrmMeetupRepository } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/typeorm-meetup-repository';
import { MeetupScheduleReader } from '../src/bounded-contexts/meetups/application/public/meetup-schedule-reader';
import type {
  RecommendationPlaceSnapshot,
  RecommendationRun,
} from '../src/bounded-contexts/recommendations/domain/recommendation-run';
import { RecommendationCandidateEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-candidate.typeorm-entity';
import { RecommendationRunEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-run.typeorm-entity';
import { TypeOrmRecommendationRunRepository } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/typeorm-recommendation-run.repository';
import { CreateAuthTables1760000001000 } from '../src/infrastructure/database/migrations/1760000001000-create-auth-tables';
import { CreateUserPreferencesTables1760000002000 } from '../src/infrastructure/database/migrations/1760000002000-create-user-preferences-tables';
import { CreateMeetupsTables1792070000000 } from '../src/infrastructure/database/migrations/1792070000000-create-meetups-tables';
import { CreateRecommendationRunBaseline1792080000000 } from '../src/infrastructure/database/migrations/1792080000000-create-recommendation-run-baseline';
import { AddRecommendationRankingSnapshots1792090000000 } from '../src/infrastructure/database/migrations/1792090000000-add-recommendation-ranking-snapshots';
import { RecommendationMemberFeatureEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-member-feature.typeorm-entity';
import { AddRecommendationTemporalContext1792100000000 } from '../src/infrastructure/database/migrations/1792100000000-add-recommendation-temporal-context';
import { CreateMeetupParticipantPreferencesTable1792070001000 } from '../src/infrastructure/database/migrations/1792070001000-create-meetup-participant-preferences-table';
import { MeetupsScheduleAdapter } from '../src/bounded-contexts/recommendations/infrastructure/adapters/meetups-schedule.adapter';
import { RecommendationRunFreshnessGuard } from '../src/bounded-contexts/recommendations/application/public/recommendation-run-freshness.guard';
import { RecommendationPlaceEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-place.typeorm-entity';
import { OutboxEventTypeOrmEntity } from '../src/infrastructure/outbox/persistence/outbox-event.typeorm-entity';
import { CreateOutboxEventsTable1760000006000 } from '../src/infrastructure/database/migrations/1760000006000-create-outbox-events-table';
import { CreateRecommendationResults1792110000000 } from '../src/infrastructure/database/migrations/1792110000000-create-recommendation-results';

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
  const participantId = randomUUID();
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
        ParticipantPreferenceEntity,
        RecommendationRunEntity,
        RecommendationCandidateEntity,
        RecommendationMemberFeatureEntity,
        RecommendationPlaceEntity,
        OutboxEventTypeOrmEntity,
      ],
      migrations: [
        CreateAuthTables1760000001000,
        CreateUserPreferencesTables1760000002000,
        CreateOutboxEventsTable1760000006000,
        CreateMeetupsTables1792070000000,
        CreateMeetupParticipantPreferencesTable1792070001000,
        CreateRecommendationRunBaseline1792080000000,
        AddRecommendationRankingSnapshots1792090000000,
        AddRecommendationTemporalContext1792100000000,
        CreateRecommendationResults1792110000000,
      ],
    }).initialize();

    await db.runMigrations();
    await assertTemporalSchema(db, schema);
    await assertResultSchema(db, schema);
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
        'effective_k',
        'final_rank',
        'scheduled_at_snapshot',
        'scheduled_opening_status',
      ]),
    );
    await db.undoLastMigration();
    expect(
      await db.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'recommendation_places'`,
        [schema],
      ),
    ).toEqual([]);
    expect(
      await db.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'recommendation_runs' AND column_name = 'scheduled_at_snapshot'`,
        [schema],
      ),
    ).toEqual([{ column_name: 'scheduled_at_snapshot' }]);
    await db.runMigrations();
    await assertTemporalSchema(db, schema);
    await assertResultSchema(db, schema);
    expect(
      await db.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = $1
           AND table_name = 'recommendation_member_features'
           AND column_name = 'recommended_departure_at'`,
        [schema],
      ),
    ).toEqual([]);

    await db.query(
      `INSERT INTO user_accounts (id, email, display_name, created_at, updated_at) VALUES ($1, $2, 'Actor', NOW(), NOW())`,
      [actorId, `${actorId}@test.invalid`],
    );
    await db.query(
      `INSERT INTO meetup_sessions (id, organizer_id, title, scheduled_at, invitation_deadline_at, search_radius_m, place_type, recommendation_mode, status, created_at, updated_at) VALUES ($1, $2, 'Test', '2026-10-30T19:00:00Z', '2026-10-30T18:00:00Z', 1000, 'cafe', 'balanced', 'inviting', NOW(), NOW())`,
      [meetupId, actorId],
    );
    await db.query(
      `INSERT INTO meetup_participants (id, meetup_id, user_id, status, invited_by_id, responded_at, joined_at) VALUES ($1, $2, $3, 'accepted', $3, NOW(), NOW())`,
      [participantId, meetupId, actorId],
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
      providerRequestOptionsVersion:
        'google-places-text-search-v2-scheduled-opening',
      openingFilter: 'OPEN_AT_SCHEDULED_TIME',
      openingEvaluatorVersion: 'scheduled-opening-evaluator-v1',
      requestedAt: new Date('2026-10-30T10:00:00Z'),
      scheduledAtSnapshot: new Date('2026-10-30T19:00:00Z'),
      createdAt: new Date(),
      completedAt: null,
      effectiveK: null,
      warnings: [],
      randomSeed: null,
      routeBatchCount: null,
      routeElementCount: null,
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

  it('backfills pre-temporal runs as explicitly legacy and stale-safe', async () => {
    const legacySchema = `recommendation_legacy_${randomUUID().replaceAll('-', '')}`;
    let legacyDb: DataSource | undefined;
    try {
      await bootstrap.query(`CREATE SCHEMA "${legacySchema}"`);
      legacyDb = await new DataSource({
        type: 'postgres',
        url: databaseUrl,
        schema: legacySchema,
        extra: { options: `-c search_path=${legacySchema},public` },
        ssl: databaseUrl?.includes('sslmode=require'),
        synchronize: false,
        entities: [],
        migrations: [
          CreateAuthTables1760000001000,
          CreateMeetupsTables1792070000000,
          CreateRecommendationRunBaseline1792080000000,
          AddRecommendationRankingSnapshots1792090000000,
        ],
      }).initialize();
      await legacyDb.runMigrations();
      const legacyActorId = randomUUID();
      const legacyMeetupId = randomUUID();
      const legacyRunId = randomUUID();
      await legacyDb.query(
        `INSERT INTO user_accounts (id, email, display_name, created_at, updated_at)
         VALUES ($1, $2, 'Legacy Actor', '2026-10-29T09:00:00Z', '2026-10-29T09:00:00Z')`,
        [legacyActorId, `${legacyActorId}@test.invalid`],
      );
      await legacyDb.query(
        `INSERT INTO meetup_sessions
          (id, organizer_id, title, scheduled_at, invitation_deadline_at,
           search_radius_m, place_type, recommendation_mode, status,
           created_at, updated_at)
         VALUES
          ($1, $2, 'Legacy', '2026-10-30T19:00:00Z',
           '2026-10-30T18:00:00Z', 1000, 'cafe', 'balanced', 'inviting',
           '2026-10-29T09:00:00Z', '2026-10-29T09:00:00Z')`,
        [legacyMeetupId, legacyActorId],
      );
      await legacyDb.query(
        `INSERT INTO recommendation_runs
          (id, meetup_id, request_id, payload_hash, requested_by_id, requested_k,
           status, ranking_strategy, algorithm_version, config_version,
           feature_schema_version, provider_mapping_version, created_at)
         VALUES
          ($1, $2, $3, $4, $5, 1, 'RUNNING', 'min-sum', 'algorithm-v1',
           'config-v1', 'features-v1', 'mapping-v1', '2026-10-29T10:00:00Z')`,
        [
          legacyRunId,
          legacyMeetupId,
          randomUUID(),
          'a'.repeat(64),
          legacyActorId,
        ],
      );
      const runner = legacyDb.createQueryRunner();
      await runner.connect();
      try {
        await new AddRecommendationTemporalContext1792100000000().up(runner);
      } finally {
        await runner.release();
      }
      await expect(
        legacyDb.query(
          `SELECT provider_request_options_version, opening_filter,
                  opening_evaluator_version, requested_at,
                  scheduled_at_snapshot, warnings
             FROM recommendation_runs
            WHERE id = $1`,
          [legacyRunId],
        ),
      ).resolves.toEqual([
        {
          provider_request_options_version: 'legacy-pre-temporal-v1',
          opening_filter: 'ANY',
          opening_evaluator_version: 'not-applied',
          requested_at: new Date('2026-10-29T10:00:00Z'),
          scheduled_at_snapshot: new Date('2026-10-30T19:00:00Z'),
          warnings: ['LEGACY_TEMPORAL_CONTEXT_BACKFILL'],
        },
      ]);
      const cycleRunner = legacyDb.createQueryRunner();
      await cycleRunner.connect();
      try {
        const migration = new AddRecommendationTemporalContext1792100000000();
        await migration.down(cycleRunner);
        await migration.up(cycleRunner);
      } finally {
        await cycleRunner.release();
      }
      await expect(
        legacyDb.query(
          'SELECT warnings FROM recommendation_runs WHERE id = $1',
          [legacyRunId],
        ),
      ).resolves.toEqual([{ warnings: ['LEGACY_TEMPORAL_CONTEXT_BACKFILL'] }]);
    } finally {
      if (legacyDb?.isInitialized) await legacyDb.destroy();
      await bootstrap.query(`DROP SCHEMA IF EXISTS "${legacySchema}" CASCADE`);
    }
  });

  it('commits candidates atomically and enforces database constraints', async () => {
    const invalid = run();
    await repository.create(invalid);
    await expect(
      repository.complete(
        invalid.id,
        {
          candidates: [
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
              normalizedTags: ['cafe'],
              rating0To5: null,
              userRatingCount: null,
              finalRank: 1,
              groupUtility: 0.5,
              candidateLeastMiseryUtility: 0.5,
              paretoLevel: 1,
              inclusionProbability: 1,
              avgEtaSeconds: 300,
              maxEtaSeconds: 300,
              etaRangeSeconds: 0,
              scheduledOpeningStatus: 'OPEN',
              openingEvidence: {
                evaluatorVersion: 'scheduled-opening-evaluator-v1',
                source: 'REGULAR',
                evaluatedLocalDateTime: '2026-10-31T02:00',
                utcOffsetMinutes: 420,
                fallbackToRegularHours: true,
              },
            },
          ],
          memberFeatures: [],
          places: [],
          effectiveK: 1,
          warnings: [],
          randomSeed: 'seed',
          routeBatchCount: 1,
          routeElementCount: 1,
          readyEventId: randomUUID(),
        },
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
    const validCandidateId = randomUUID();
    const readyEventId = randomUUID();
    const validPlace = place(
      valid.id,
      validCandidateId,
      'google-places:cafe-1',
      1,
    );
    const completed = await repository.complete(
      valid.id,
      {
        candidates: [
          {
            id: validCandidateId,
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
            normalizedTags: ['cafe'],
            rating0To5: 4.5,
            userRatingCount: 99,
            finalRank: 1,
            groupUtility: 0.7,
            candidateLeastMiseryUtility: 0.7,
            paretoLevel: 1,
            inclusionProbability: 1,
            avgEtaSeconds: 300,
            maxEtaSeconds: 300,
            etaRangeSeconds: 0,
            scheduledOpeningStatus: 'OPEN',
            openingEvidence: {
              evaluatorVersion: 'scheduled-opening-evaluator-v1',
              source: 'REGULAR',
              evaluatedLocalDateTime: '2026-10-31T02:00',
              utcOffsetMinutes: 420,
              fallbackToRegularHours: true,
            },
          },
        ],
        memberFeatures: [
          {
            id: randomUUID(),
            runId: valid.id,
            candidateId: validCandidateId,
            participantId,
            canonicalCandidateKey: 'google-places:cafe-1',
            etaSeconds: 1500,
            distanceMeters: 1000,
            matchedTags: [],
            missingFlags: [],
            travelUtility: 0.5,
            preferenceUtility: 0.5,
            placeQualityUtility: 0.5,
            memberUtility: 0.5,
            routeStatus: 'OK',
            createdAt: new Date(),
          },
        ],
        places: [validPlace],
        effectiveK: 1,
        warnings: ['RESULT_COUNT_BELOW_REQUESTED_K'],
        randomSeed: 'seed',
        routeBatchCount: 1,
        routeElementCount: 1,
        readyEventId,
      },
      new Date(),
    );
    expect(completed).toMatchObject({
      status: 'COMPLETED',
      effectiveK: 1,
      warnings: ['RESULT_COUNT_BELOW_REQUESTED_K'],
    });
    expect(completed.candidates).toHaveLength(1);
    expect(completed.memberFeatures).toHaveLength(1);
    expect(completed.places).toEqual([validPlace]);
    expect(completed.memberFeatures[0].etaSeconds).toBe(1_500);
    const persisted = await repository.findById(meetupId, valid.id);
    expect(persisted).toMatchObject({
      scheduledAtSnapshot: new Date('2026-10-30T19:00:00Z'),
      openingFilter: 'OPEN_AT_SCHEDULED_TIME',
    });
    expect(persisted?.candidates[0]).toMatchObject({
      scheduledOpeningStatus: 'OPEN',
    });
    expect(persisted?.memberFeatures[0].etaSeconds).toBe(1_500);
    expect(persisted?.places[0].explanation.facts).toEqual(
      validPlace.explanation.facts,
    );
    const outboxRows = await db.query<
      Array<{
        event_name: string;
        destination: string;
        payload: Record<string, unknown>;
      }>
    >(
      `SELECT event_name, destination, payload FROM outbox_events WHERE id = $1`,
      [readyEventId],
    );
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0].event_name).toBe('RecommendationReady.v1');
    expect(outboxRows[0].destination).toBe('realtime');
    expect(outboxRows[0].payload).toMatchObject({
      eventId: readyEventId,
      meetupId,
      runId: valid.id,
      placeIds: ['cafe-1'],
    });

    const freshness = new RecommendationRunFreshnessGuard(
      repository,
      new MeetupsScheduleAdapter(
        new MeetupScheduleReader(new TypeOrmMeetupRepository(db)),
      ),
    );
    await expect(freshness.status(persisted!)).resolves.toBe('CURRENT_CONTEXT');
    await expect(
      freshness.status({
        ...persisted!,
        providerRequestOptionsVersion: 'legacy-pre-temporal-v1',
      }),
    ).resolves.toBe('STALE_CONTEXT');
    await db.query(
      `UPDATE meetup_sessions
          SET scheduled_at = '2026-10-30T20:00:00Z'
        WHERE id = $1`,
      [meetupId],
    );
    await expect(freshness.status(persisted!)).resolves.toBe('STALE_CONTEXT');
    await expect(
      freshness.assertFreshForDecision(meetupId, valid.id),
    ).rejects.toMatchObject({ code: 'RECOMMENDATION_STALE_CONTEXT' });
    await expect(
      repository.findById(meetupId, valid.id),
    ).resolves.toMatchObject({
      status: 'COMPLETED',
      scheduledAtSnapshot: new Date('2026-10-30T19:00:00Z'),
    });
  });

  it('rolls back persisted snapshots and ready event when the state transition fails', async () => {
    const faulted = run();
    const candidateId = randomUUID();
    const eventId = randomUUID();
    await repository.create(faulted);
    await db.query(`
      CREATE FUNCTION ${schema}.reject_recommendation_completion()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.status = 'COMPLETED' THEN
          RAISE EXCEPTION 'injected completion transition failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_recommendation_completion
      BEFORE UPDATE ON recommendation_runs
      FOR EACH ROW EXECUTE FUNCTION ${schema}.reject_recommendation_completion();
    `);
    try {
      await expect(
        repository.complete(
          faulted.id,
          {
            candidates: [candidate(faulted.id, candidateId)],
            memberFeatures: [
              memberFeature(faulted.id, candidateId, participantId),
            ],
            places: [
              place(faulted.id, candidateId, 'google-places:faulted', 1),
            ],
            effectiveK: 1,
            warnings: [],
            randomSeed: 'seed',
            routeBatchCount: 1,
            routeElementCount: 1,
            readyEventId: eventId,
          },
          new Date(),
        ),
      ).rejects.toThrow('injected completion transition failure');
    } finally {
      await db.query(
        'DROP TRIGGER reject_recommendation_completion ON recommendation_runs',
      );
      await db.query(
        `DROP FUNCTION ${schema}.reject_recommendation_completion()`,
      );
    }
    await expect(
      repository.findById(meetupId, faulted.id),
    ).resolves.toMatchObject({
      status: 'RUNNING',
      candidates: [],
      memberFeatures: [],
      places: [],
    });
    await expect(
      db.query('SELECT id FROM outbox_events WHERE id = $1', [eventId]),
    ).resolves.toEqual([]);
  });
});

function candidate(runId: string, id: string) {
  return {
    id,
    runId,
    canonicalCandidateKey: 'google-places:faulted',
    provider: 'google-places',
    providerPlaceId: 'faulted',
    name: 'Faulted',
    latitude: 10.7,
    longitude: 106.7,
    providerTypes: ['cafe'],
    sourceCategories: ['cafe'],
    sourcePages: [1],
    filterStatus: 'ELIGIBLE' as const,
    filterReason: null,
    createdAt: new Date(),
    normalizedTags: ['cafe'],
    rating0To5: 4,
    userRatingCount: 10,
    finalRank: 1,
    groupUtility: 0.7,
    candidateLeastMiseryUtility: 0.6,
    paretoLevel: 1,
    inclusionProbability: 1,
    avgEtaSeconds: 300,
    maxEtaSeconds: 300,
    etaRangeSeconds: 0,
    scheduledOpeningStatus: 'OPEN' as const,
    openingEvidence: null,
  };
}

function memberFeature(
  runId: string,
  candidateId: string,
  participantId: string,
) {
  return {
    id: randomUUID(),
    runId,
    candidateId,
    participantId,
    canonicalCandidateKey: 'google-places:faulted',
    etaSeconds: 300,
    distanceMeters: 1000,
    matchedTags: [],
    missingFlags: [],
    travelUtility: 0.7,
    preferenceUtility: 0.7,
    placeQualityUtility: 0.7,
    memberUtility: 0.7,
    routeStatus: 'OK' as const,
    createdAt: new Date(),
  };
}

function place(
  runId: string,
  candidateId: string,
  canonicalCandidateKey: string,
  rank: number,
): RecommendationPlaceSnapshot {
  return {
    id: randomUUID(),
    runId,
    candidateId,
    canonicalCandidateKey,
    rank,
    groupUtility: 0.7,
    candidateLeastMiseryUtility: 0.6,
    paretoLevel: 1,
    inclusionProbability: 1,
    avgEtaSeconds: 300,
    maxEtaSeconds: 300,
    etaRangeSeconds: 0,
    scheduledOpeningStatus: 'OPEN',
    openingEvidence: null,
    explanation: {
      summaryCode: 'FAIR_PARETO_RANKED',
      facts: [
        { key: 'rank', value: rank, unit: 'COUNT', source: 'ENGINE' },
        { key: 'avgEtaSeconds', value: 300, unit: 'SECOND', source: 'ROUTES' },
      ],
      warnings: [],
    },
    createdAt: new Date(),
  };
}

async function assertResultSchema(db: DataSource, schema: string) {
  const columns = await db.query<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'recommendation_places'`,
    [schema],
  );
  expect(columns.map((row) => row.column_name)).toEqual(
    expect.arrayContaining([
      'run_id',
      'candidate_id',
      'rank',
      'group_utility',
      'candidate_least_misery_utility',
      'explanation',
    ]),
  );
}

async function assertTemporalSchema(db: DataSource, schema: string) {
  const columns = await db.query<
    Array<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: 'YES' | 'NO';
    }>
  >(
    `SELECT table_name, column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = $1
        AND (
          (table_name = 'recommendation_runs' AND column_name IN (
            'provider_request_options_version', 'opening_filter',
            'opening_evaluator_version', 'requested_at', 'scheduled_at_snapshot'
          ))
          OR (table_name = 'recommendation_candidates' AND column_name IN (
            'scheduled_opening_status', 'opening_evidence'
          ))
        )
      ORDER BY table_name, column_name`,
    [schema],
  );
  expect(columns).toEqual([
    {
      table_name: 'recommendation_candidates',
      column_name: 'opening_evidence',
      data_type: 'jsonb',
      is_nullable: 'YES',
    },
    {
      table_name: 'recommendation_candidates',
      column_name: 'scheduled_opening_status',
      data_type: 'character varying',
      is_nullable: 'YES',
    },
    {
      table_name: 'recommendation_runs',
      column_name: 'opening_evaluator_version',
      data_type: 'character varying',
      is_nullable: 'NO',
    },
    {
      table_name: 'recommendation_runs',
      column_name: 'opening_filter',
      data_type: 'character varying',
      is_nullable: 'NO',
    },
    {
      table_name: 'recommendation_runs',
      column_name: 'provider_request_options_version',
      data_type: 'character varying',
      is_nullable: 'NO',
    },
    {
      table_name: 'recommendation_runs',
      column_name: 'requested_at',
      data_type: 'timestamp with time zone',
      is_nullable: 'NO',
    },
    {
      table_name: 'recommendation_runs',
      column_name: 'scheduled_at_snapshot',
      data_type: 'timestamp with time zone',
      is_nullable: 'NO',
    },
  ]);
  const constraints = await db.query<Array<{ conname: string }>>(
    `SELECT conname
       FROM pg_constraint
      WHERE connamespace = $1::regnamespace
        AND conname IN (
          'chk_recommendation_runs_opening_filter',
          'chk_recommendation_candidates_scheduled_opening'
        )
      ORDER BY conname`,
    [schema],
  );
  expect(constraints).toEqual([
    { conname: 'chk_recommendation_candidates_scheduled_opening' },
    { conname: 'chk_recommendation_runs_opening_filter' },
  ]);
}
