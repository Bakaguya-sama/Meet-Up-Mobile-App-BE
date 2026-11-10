import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ManageAccountLockUseCase as ManageAuthAccountLockUseCase } from '../src/bounded-contexts/auth/application/use-cases/manage-account-lock.use-case';
import { TypeOrmAuthUnitOfWork } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/typeorm-auth-unit-of-work';
import { UserAccountEntity } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/entities/user-account.typeorm-entity';
import { UserSessionEntity } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/entities/user-session.typeorm-entity';
import { AuditLogEntity } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/entities/audit-log.typeorm-entity';
import { ManageAccountLockUseCase as ManageAdminAccountLockUseCase } from '../src/bounded-contexts/admin/application/use-cases/manage-account-lock.use-case';
import { AdminError } from '../src/bounded-contexts/admin/domain/errors/admin.error';
import { ChatError } from '../src/bounded-contexts/chat/domain/errors/chat.error';
import { ListMeetupChatMessagesQuery } from '../src/bounded-contexts/chat/application/queries/list-meetup-chat-messages.query';
import { SendMeetupChatMessageUseCase } from '../src/bounded-contexts/chat/application/use-cases/send-meetup-chat-message.use-case';
import { MeetupChatAccessAdapter } from '../src/bounded-contexts/chat/infrastructure/adapters/meetup-chat-access.adapter';
import { RealtimeChatMessagePublisherAdapter } from '../src/bounded-contexts/chat/infrastructure/adapters/realtime-chat-message-publisher.adapter';
import { MeetupChatMessageEntity } from '../src/bounded-contexts/chat/infrastructure/persistence/typeorm/entities/meetup-chat-message.typeorm-entity';
import { TypeOrmMeetupChatStore } from '../src/bounded-contexts/chat/infrastructure/persistence/typeorm/typeorm-meetup-chat-store';
import { MeetupMembershipReader } from '../src/bounded-contexts/meetups/application/public/meetup-membership-reader';
import { MeetupEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/meetup.typeorm-entity';
import { ParticipantEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/participant.typeorm-entity';
import { ParticipantPreferenceEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/participant-preference.typeorm-entity';
import { TypeOrmMeetupRepository } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/typeorm-meetup-repository';
import { TypeOrmFavoritePlaceStore } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/typeorm-favorite-place-store';
import { FavoritePlaceEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/favorite-place.typeorm-entity';
import { RecommendationCandidateEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-candidate.typeorm-entity';
import { RecommendationRunEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-run.typeorm-entity';
import { RecommendationMemberFeatureEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-member-feature.typeorm-entity';
import { RecommendationPlaceEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-place.typeorm-entity';
import type {
  RealtimeMessage,
  RealtimePublisherPort,
} from '../src/shared-kernel/application/realtime-publisher.port';
import { CreateAuthTables1760000001000 } from '../src/infrastructure/database/migrations/1760000001000-create-auth-tables';
import { CreateUserPreferencesTables1760000002000 } from '../src/infrastructure/database/migrations/1760000002000-create-user-preferences-tables';
import { CreateOutboxEventsTable1760000006000 } from '../src/infrastructure/database/migrations/1760000006000-create-outbox-events-table';
import { CreateMeetupsTables1792070000000 } from '../src/infrastructure/database/migrations/1792070000000-create-meetups-tables';
import { CreateMeetupParticipantPreferencesTable1792070001000 } from '../src/infrastructure/database/migrations/1792070001000-create-meetup-participant-preferences-table';
import { CreateRecommendationRunBaseline1792080000000 } from '../src/infrastructure/database/migrations/1792080000000-create-recommendation-run-baseline';
import { AddRecommendationRankingSnapshots1792090000000 } from '../src/infrastructure/database/migrations/1792090000000-add-recommendation-ranking-snapshots';
import { AddRecommendationTemporalContext1792100000000 } from '../src/infrastructure/database/migrations/1792100000000-add-recommendation-temporal-context';
import { CreateRecommendationResults1792110000000 } from '../src/infrastructure/database/migrations/1792110000000-create-recommendation-results';
import { AddPublicHandleToUserAccounts1792130000000 } from '../src/infrastructure/database/migrations/1792130000000-add-public-handle-to-user-accounts';
import { AddChatFavoritesAndAdminAudit1792140000000 } from '../src/infrastructure/database/migrations/1792140000000-add-chat-favorites-admin-audit';
import { EnforceMeetupChatAccess1792150000000 } from '../src/infrastructure/database/migrations/1792150000000-enforce-meetup-chat-access';
import { AddRecommendationTrafficWeatherContext1792160000000 } from '../src/infrastructure/database/migrations/1792160000000-add-recommendation-traffic-weather-context';
import { AddRecommendationStaticDurationMetric1792170000000 } from '../src/infrastructure/database/migrations/1792170000000-add-recommendation-static-duration-metric';

const databaseUrl = process.env.MEETUP_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('MEETUP_TEST_DATABASE_URL is required');

describe('BE-11, BE-19 and BE-20 PostgreSQL integration', () => {
  const schema = `chat_favorite_admin_${randomUUID().replaceAll('-', '')}`;
  const aliceId = randomUUID();
  const bobId = randomUUID();
  const outsiderId = randomUUID();
  const meetupId = randomUUID();
  const runId = randomUUID();
  const candidateId = randomUUID();
  const canonicalCandidateKey = `google-places:${'x'.repeat(286)}`;
  const published: RealtimeMessage[] = [];
  let bootstrap: DataSource;
  let db: DataSource;
  let chatStore: TypeOrmMeetupChatStore;
  let send: SendMeetupChatMessageUseCase;
  let list: ListMeetupChatMessagesQuery;
  let favorites: TypeOrmFavoritePlaceStore;

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
        UserSessionEntity,
        AuditLogEntity,
        MeetupEntity,
        ParticipantEntity,
        ParticipantPreferenceEntity,
        RecommendationRunEntity,
        RecommendationCandidateEntity,
        RecommendationMemberFeatureEntity,
        RecommendationPlaceEntity,
        FavoritePlaceEntity,
        MeetupChatMessageEntity,
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
        AddPublicHandleToUserAccounts1792130000000,
        AddChatFavoritesAndAdminAudit1792140000000,
        EnforceMeetupChatAccess1792150000000,
        AddRecommendationTrafficWeatherContext1792160000000,
        AddRecommendationStaticDurationMetric1792170000000,
      ],
    }).initialize();
    await db.runMigrations();
    await expectTrigger(true);
    // 179216 is unrelated to chat but is part of the current schema.
    await db.undoLastMigration();
    await db.undoLastMigration();
    await db.undoLastMigration();
    await expectTrigger(false);
    await db.undoLastMigration();
    await expect(
      db.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'meetup_chat_messages'`,
        [schema],
      ),
    ).resolves.toEqual([]);
    await db.runMigrations();
    await expectTrigger(true);

    await db.query(
      `INSERT INTO user_accounts (id, email, display_name, role, created_at, updated_at)
       SELECT id, id::text || '@test.invalid', display_name, role, NOW(), NOW()
       FROM unnest($1::uuid[], $2::text[], $3::varchar[]) AS users(id, display_name, role)`,
      [
        [aliceId, bobId, outsiderId],
        ['Alice', 'Bob', 'Outsider'],
        ['user', 'user', 'admin'],
      ],
    );
    await db.query(
      `INSERT INTO meetup_sessions (
         id, organizer_id, title, scheduled_at, invitation_deadline_at,
         search_radius_m, place_type, recommendation_mode, status, created_at, updated_at
       ) VALUES ($1, $2, 'Integration meetup', NOW() + INTERVAL '2 hours',
         NOW() + INTERVAL '1 hour', 1000, 'cafe', 'balanced', 'inviting', NOW(), NOW())`,
      [meetupId, aliceId],
    );
    await db.query(
      `INSERT INTO meetup_participants (id, meetup_id, user_id, status, invited_by_id, responded_at, joined_at)
       VALUES
         ($1, $3, $4, 'accepted', $4, NOW(), NOW()),
         ($2, $3, $5, 'accepted', $4, NOW(), NOW())`,
      [randomUUID(), randomUUID(), meetupId, aliceId, bobId],
    );
    await db.query(
      `INSERT INTO recommendation_runs (
         id, meetup_id, request_id, payload_hash, requested_by_id, requested_k, status,
         ranking_strategy, algorithm_version, config_version, feature_schema_version,
         provider_mapping_version, provider_request_options_version, opening_filter,
         opening_evaluator_version, requested_at, scheduled_at_snapshot, created_at
       ) VALUES ($1, $2, $3, $4, $5, 1, 'RUNNING', 'fair-pareto-v1',
         'engine-v1', 'config-v1', 'features-v1', 'mapping-v1', 'request-v1', 'ANY',
         'not-applied', NOW(), NOW() + INTERVAL '2 hours', NOW())`,
      [runId, meetupId, randomUUID(), 'a'.repeat(64), aliceId],
    );
    await db.query(
      `INSERT INTO recommendation_candidates (
         id, run_id, canonical_candidate_key, provider, provider_place_id, name,
         latitude, longitude, provider_types, source_categories, source_pages,
         filter_status, created_at
       ) VALUES ($1, $2, $3, 'google-places', 'place-1', 'Place one',
         10.7, 106.7, '[]'::jsonb, '[]'::jsonb, '[1]'::jsonb, 'ELIGIBLE', NOW())`,
      [candidateId, runId, canonicalCandidateKey],
    );

    const membership = new MeetupChatAccessAdapter(
      new MeetupMembershipReader(new TypeOrmMeetupRepository(db)),
    );
    chatStore = new TypeOrmMeetupChatStore(db);
    const realtime: RealtimePublisherPort = {
      publish(event) {
        published.push(event);
        return Promise.resolve();
      },
    };
    const chatPublisher = new RealtimeChatMessagePublisherAdapter(
      realtime,
      membership,
    );
    send = new SendMeetupChatMessageUseCase(
      chatStore,
      membership,
      chatPublisher,
    );
    list = new ListMeetupChatMessagesQuery(chatStore, membership);
    favorites = new TypeOrmFavoritePlaceStore(db);
  });

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (bootstrap?.isInitialized) {
      await bootstrap.query(`DROP SCHEMA "${schema}" CASCADE`);
      await bootstrap.destroy();
    }
  });

  async function expectTrigger(expected: boolean) {
    await expect(
      db.query(
        `SELECT trigger_name FROM information_schema.triggers
         WHERE event_object_schema = $1
           AND event_object_table = 'meetup_chat_messages'
           AND trigger_name = 'trg_meetup_chat_sender_active'`,
        [schema],
      ),
    ).resolves.toEqual(
      expected ? [{ trigger_name: 'trg_meetup_chat_sender_active' }] : [],
    );
  }

  it('retains former-member history only through leftAt, rejects their writes atomically, and excludes them from new realtime delivery', async () => {
    const historicalId = randomUUID();
    await chatStore.append({
      id: historicalId,
      meetupId,
      senderUserId: aliceId,
      textContent: 'before departure',
      sentAt: new Date(Date.now() - 120_000),
    });
    await db.query(
      `UPDATE meetup_participants
       SET status = 'left', left_at = NOW() - INTERVAL '60 seconds'
       WHERE meetup_id = $1 AND user_id = $2`,
      [meetupId, bobId],
    );
    const sentAt = new Date();
    await expect(
      chatStore.append({
        id: randomUUID(),
        meetupId,
        senderUserId: bobId,
        textContent: 'must not be stored',
        sentAt,
      }),
    ).rejects.toMatchObject({
      code: 'CHAT_FORBIDDEN',
    } satisfies Partial<ChatError>);

    published.length = 0;
    const newMessage = await send.execute({
      actorId: aliceId,
      meetupId,
      text: 'after departure',
    });
    const history = await list.execute({ actorId: bobId, meetupId, limit: 50 });
    expect(history.map((message) => message.id)).toEqual([historicalId]);
    await expect(
      send.execute({ actorId: bobId, meetupId, text: 'forbidden' }),
    ).rejects.toMatchObject({ code: 'CHAT_FORBIDDEN' });
    expect(published).toEqual([
      expect.objectContaining({
        room: `user:${aliceId}`,
        eventId: newMessage.id,
        eventName: 'meetup:chat-message',
      }),
    ]);
    expect(published[0].payload).toMatchObject({
      id: newMessage.id,
      meetupId,
      senderUserId: aliceId,
      textContent: 'after departure',
    });
    await expect(
      list.execute({ actorId: outsiderId, meetupId, limit: 50 }),
    ).rejects.toMatchObject({ code: 'CHAT_FORBIDDEN' });
  });

  it('uses the database unique key for idempotent canonical favorite add and accepts the 300-character key', async () => {
    const first = await favorites.add(aliceId, canonicalCandidateKey);
    const second = await favorites.add(aliceId, canonicalCandidateKey);
    expect(first).toMatchObject({ canonicalCandidateKey });
    expect(second).toMatchObject({ id: first?.id, canonicalCandidateKey });
    expect(await favorites.list(aliceId)).toHaveLength(1);
    expect(await favorites.add(aliceId, 'not-a-candidate')).toBeNull();
    await favorites.remove(aliceId, canonicalCandidateKey);
    expect(await favorites.list(aliceId)).toEqual([]);
  });

  it('locks and unlocks in one transaction with session revocation and redacted audit metadata', async () => {
    const sessionId = randomUUID();
    await db.query(
      `INSERT INTO user_sessions (
         id, user_account_id, refresh_token_hash, refresh_token_family_id, expires_at, created_at
       ) VALUES ($1, $2, 'session-hash', $3, NOW() + INTERVAL '1 day', NOW())`,
      [sessionId, aliceId, randomUUID()],
    );
    const authLock = new ManageAuthAccountLockUseCase(
      new TypeOrmAuthUnitOfWork(db),
    );
    const adminLock = new ManageAdminAccountLockUseCase(authLock);
    await adminLock.execute({
      actorId: outsiderId,
      accountId: aliceId,
      locked: true,
      reason: 'free-form reason must not enter audit metadata',
    });
    await expect(
      db.query(
        `SELECT is_locked, locked_reason FROM user_accounts WHERE id = $1`,
        [aliceId],
      ),
    ).resolves.toEqual([
      {
        is_locked: true,
        locked_reason: 'free-form reason must not enter audit metadata',
      },
    ]);
    const revokedSessions = await db.query<Array<{ revoked_at: Date | null }>>(
      `SELECT revoked_at FROM user_sessions WHERE id = $1`,
      [sessionId],
    );
    expect(revokedSessions[0]?.revoked_at).toBeInstanceOf(Date);
    await expect(
      db.query(
        `SELECT actor_id, action, subject_type, subject_id, metadata_json
         FROM audit_logs WHERE subject_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [aliceId],
      ),
    ).resolves.toEqual([
      {
        actor_id: outsiderId,
        action: 'account.locked',
        subject_type: 'user_account',
        subject_id: aliceId,
        metadata_json: { locked: true },
      },
    ]);
    await adminLock.execute({
      actorId: outsiderId,
      accountId: aliceId,
      locked: false,
    });
    try {
      await adminLock.execute({
        actorId: outsiderId,
        accountId: outsiderId,
        locked: true,
      });
      throw new Error('Expected self-lock to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(AdminError);
      expect((error as AdminError).code).toBe('ADMIN_SELF_LOCK');
    }
  });
});
