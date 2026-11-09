import { randomUUID } from 'node:crypto';
import {
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { ManageAccountLockUseCase as ManageAuthAccountLockUseCase } from '../src/bounded-contexts/auth/application/use-cases/manage-account-lock.use-case';
import { TypeOrmAuthUnitOfWork } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/typeorm-auth-unit-of-work';
import { AuditLogEntity } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/entities/audit-log.typeorm-entity';
import { UserAccountEntity } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/entities/user-account.typeorm-entity';
import { UserSessionEntity } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/entities/user-session.typeorm-entity';
import { ManageAccountLockUseCase as ManageAdminAccountLockUseCase } from '../src/bounded-contexts/admin/application/use-cases/manage-account-lock.use-case';
import { AdminAccountsController } from '../src/bounded-contexts/admin/presentation/http/admin-accounts.controller';
import { ListMeetupChatMessagesQuery } from '../src/bounded-contexts/chat/application/queries/list-meetup-chat-messages.query';
import { SendMeetupChatMessageUseCase } from '../src/bounded-contexts/chat/application/use-cases/send-meetup-chat-message.use-case';
import { MeetupChatAccessAdapter } from '../src/bounded-contexts/chat/infrastructure/adapters/meetup-chat-access.adapter';
import { RealtimeChatMessagePublisherAdapter } from '../src/bounded-contexts/chat/infrastructure/adapters/realtime-chat-message-publisher.adapter';
import { MeetupChatMessageEntity } from '../src/bounded-contexts/chat/infrastructure/persistence/typeorm/entities/meetup-chat-message.typeorm-entity';
import { TypeOrmMeetupChatStore } from '../src/bounded-contexts/chat/infrastructure/persistence/typeorm/typeorm-meetup-chat-store';
import { MeetupChatController } from '../src/bounded-contexts/chat/presentation/http/meetup-chat.controller';
import { MeetupMembershipReader } from '../src/bounded-contexts/meetups/application/public/meetup-membership-reader';
import { MeetupEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/meetup.typeorm-entity';
import { ParticipantEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/participant.typeorm-entity';
import { ParticipantPreferenceEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/participant-preference.typeorm-entity';
import { TypeOrmMeetupRepository } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/typeorm-meetup-repository';
import { TypeOrmFavoritePlaceStore } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/typeorm-favorite-place-store';
import { FavoritePlaceEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/favorite-place.typeorm-entity';
import { RecommendationCandidateEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-candidate.typeorm-entity';
import { RecommendationMemberFeatureEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-member-feature.typeorm-entity';
import { RecommendationPlaceEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-place.typeorm-entity';
import { RecommendationRunEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-run.typeorm-entity';
import { AddFavoritePlaceUseCase } from '../src/bounded-contexts/recommendations/application/use-cases/add-favorite-place.use-case';
import { ListFavoritePlacesUseCase } from '../src/bounded-contexts/recommendations/application/use-cases/list-favorite-places.use-case';
import { RemoveFavoritePlaceUseCase } from '../src/bounded-contexts/recommendations/application/use-cases/remove-favorite-place.use-case';
import { FavoritePlacesController } from '../src/bounded-contexts/recommendations/presentation/http/favorite-places.controller';
import { configureApp } from '../src/configure-app';
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
import { AccessTokenGuard } from '../src/presentation/http/guards/access-token.guard';
import { RolesGuard } from '../src/presentation/http/guards/roles.guard';
import type { RealtimePublisherPort } from '../src/shared-kernel/application/realtime-publisher.port';
import type { Request } from 'express';

const databaseUrl = process.env.MEETUP_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('MEETUP_TEST_DATABASE_URL is required');

describe('BE-11, BE-19 and BE-20 HTTP over PostgreSQL', () => {
  const schema = `chat_favorite_admin_http_${randomUUID().replaceAll('-', '')}`;
  const memberId = randomUUID();
  const otherMemberId = randomUUID();
  const adminId = randomUUID();
  const meetupId = randomUUID();
  const candidateKey = `google-places:${'y'.repeat(286)}`;
  let bootstrap: DataSource;
  let db: DataSource;
  let app: INestApplication<App>;

  beforeAll(async () => {
    bootstrap = await new DataSource({
      type: 'postgres',
      url: databaseUrl,
    }).initialize();
    await bootstrap.query(`CREATE SCHEMA "${schema}"`);
    db = await new DataSource({
      type: 'postgres',
      url: databaseUrl,
      schema,
      extra: { options: `-c search_path=${schema},public` },
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
      ],
    }).initialize();
    await db.runMigrations();
    await db.query(
      `INSERT INTO user_accounts (id, email, display_name, role, created_at, updated_at)
       SELECT id, id::text || '@test.invalid', name, role, NOW(), NOW()
       FROM unnest($1::uuid[], $2::text[], $3::varchar[]) AS users(id, name, role)`,
      [
        [memberId, otherMemberId, adminId],
        ['Member', 'Other', 'Admin'],
        ['user', 'user', 'admin'],
      ],
    );
    await db.query(
      `INSERT INTO meetup_sessions (id, organizer_id, title, scheduled_at, invitation_deadline_at, search_radius_m, place_type, recommendation_mode, status, created_at, updated_at)
       VALUES ($1, $2, 'HTTP meetup', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '1 hour', 1000, 'cafe', 'balanced', 'inviting', NOW(), NOW())`,
      [meetupId, memberId],
    );
    await db.query(
      `INSERT INTO meetup_participants (id, meetup_id, user_id, status, invited_by_id, responded_at, joined_at)
       VALUES ($1, $3, $4, 'accepted', $4, NOW(), NOW()), ($2, $3, $5, 'accepted', $4, NOW(), NOW())`,
      [randomUUID(), randomUUID(), meetupId, memberId, otherMemberId],
    );
    const runId = randomUUID();
    await db.query(
      `INSERT INTO recommendation_runs (id, meetup_id, request_id, payload_hash, requested_by_id, requested_k, status, ranking_strategy, algorithm_version, config_version, feature_schema_version, provider_mapping_version, provider_request_options_version, opening_filter, opening_evaluator_version, requested_at, scheduled_at_snapshot, created_at)
       VALUES ($1, $2, $3, $4, $5, 1, 'RUNNING', 'fair-pareto-v1', 'engine-v1', 'config-v1', 'features-v1', 'mapping-v1', 'request-v1', 'ANY', 'not-applied', NOW(), NOW() + INTERVAL '2 hours', NOW())`,
      [runId, meetupId, randomUUID(), 'a'.repeat(64), memberId],
    );
    await db.query(
      `INSERT INTO recommendation_candidates (id, run_id, canonical_candidate_key, provider, provider_place_id, name, latitude, longitude, provider_types, source_categories, source_pages, filter_status, created_at)
       VALUES ($1, $2, $3, 'google-places', 'http-place', 'HTTP place', 10.7, 106.7, '[]'::jsonb, '[]'::jsonb, '[1]'::jsonb, 'ELIGIBLE', NOW())`,
      [randomUUID(), runId, candidateKey],
    );

    const meetupAccess = new MeetupChatAccessAdapter(
      new MeetupMembershipReader(new TypeOrmMeetupRepository(db)),
    );
    const chatStore = new TypeOrmMeetupChatStore(db);
    const realtime: RealtimePublisherPort = {
      publish: () => Promise.resolve(),
    };
    const chatPublisher = new RealtimeChatMessagePublisherAdapter(
      realtime,
      meetupAccess,
    );
    const fixture = await Test.createTestingModule({
      controllers: [
        MeetupChatController,
        FavoritePlacesController,
        AdminAccountsController,
      ],
      providers: [
        {
          provide: ConfigService,
          useValue: new ConfigService({
            app: { apiPrefix: 'api/v1', swaggerEnabled: false },
          }),
        },
        {
          provide: SendMeetupChatMessageUseCase,
          useValue: new SendMeetupChatMessageUseCase(
            chatStore,
            meetupAccess,
            chatPublisher,
          ),
        },
        {
          provide: ListMeetupChatMessagesQuery,
          useValue: new ListMeetupChatMessagesQuery(chatStore, meetupAccess),
        },
        {
          provide: AddFavoritePlaceUseCase,
          useValue: new AddFavoritePlaceUseCase(
            new TypeOrmFavoritePlaceStore(db),
          ),
        },
        {
          provide: ListFavoritePlacesUseCase,
          useValue: new ListFavoritePlacesUseCase(
            new TypeOrmFavoritePlaceStore(db),
          ),
        },
        {
          provide: RemoveFavoritePlaceUseCase,
          useValue: new RemoveFavoritePlaceUseCase(
            new TypeOrmFavoritePlaceStore(db),
          ),
        },
        {
          provide: ManageAdminAccountLockUseCase,
          useValue: new ManageAdminAccountLockUseCase(
            new ManageAuthAccountLockUseCase(new TypeOrmAuthUnitOfWork(db)),
          ),
        },
        AccessTokenGuard,
        RolesGuard,
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const request = context.switchToHttp().getRequest<
            Request & {
              user?: { id: string; roles: readonly ('user' | 'admin')[] };
            }
          >();
          const id = request.headers.authorization?.replace('Bearer ', '');
          if (!id || ![memberId, otherMemberId, adminId].includes(id))
            throw new UnauthorizedException();
          request.user = { id, roles: id === adminId ? ['admin'] : ['user'] };
          return true;
        },
      })
      .compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (db?.isInitialized) await db.destroy();
    if (bootstrap?.isInitialized) {
      await bootstrap.query(`DROP SCHEMA "${schema}" CASCADE`);
      await bootstrap.destroy();
    }
  });

  const auth = (id: string) => ({ Authorization: `Bearer ${id}` });

  function responseString(response: { body: unknown }, field: string): string {
    const body = response.body as Record<string, unknown>;
    const value = body[field];
    if (typeof value !== 'string') {
      throw new Error(`Expected response field ${field} to be a string`);
    }
    return value;
  }

  it('persists an accepted member message and denies an outsider through HTTP', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/chat/messages`)
      .set(auth(memberId))
      .send({ text: '  HTTP chat  ' })
      .expect(201);
    expect(created.body).toMatchObject({
      meetupId,
      senderUserId: memberId,
      textContent: 'HTTP chat',
    });
    await request(app.getHttpServer())
      .get(`/api/v1/meetups/${meetupId}/chat/messages`)
      .set(auth(otherMemberId))
      .expect(200)
      .expect(({ body }: { body: unknown }) => expect(body).toHaveLength(1));
    await request(app.getHttpServer())
      .get(`/api/v1/meetups/${meetupId}/chat/messages`)
      .set(auth(adminId))
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/chat/messages`)
      .set(auth(memberId))
      .send({ text: '' })
      .expect(400);
  });

  it('validates, de-duplicates, lists and deletes favorites through HTTP', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/favorites/places')
      .set(auth(memberId))
      .send({ placeId: candidateKey })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/v1/favorites/places')
      .set(auth(memberId))
      .send({ placeId: candidateKey })
      .expect(201);
    expect(second.body).toMatchObject({
      id: responseString(first, 'id'),
      canonicalCandidateKey: candidateKey,
    });
    await request(app.getHttpServer())
      .get('/api/v1/favorites/places')
      .set(auth(memberId))
      .expect(200)
      .expect(({ body }: { body: unknown }) => expect(body).toHaveLength(1));
    await request(app.getHttpServer())
      .delete(`/api/v1/favorites/places/${encodeURIComponent(candidateKey)}`)
      .set(auth(memberId))
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/favorites/places')
      .set(auth(memberId))
      .send({ placeId: 'x'.repeat(301) })
      .expect(400);
  });

  it('enforces the admin role before mutating account state', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/accounts/${otherMemberId}/lock`)
      .set(auth(memberId))
      .send({ reason: 'not authorized' })
      .expect(403);
    const locked = await request(app.getHttpServer())
      .post(`/api/v1/admin/accounts/${otherMemberId}/lock`)
      .set(auth(adminId))
      .send({ reason: 'account review' })
      .expect(200);
    expect(locked.body).toMatchObject({ id: otherMemberId, locked: true });
    const unlocked = await request(app.getHttpServer())
      .delete(`/api/v1/admin/accounts/${otherMemberId}/lock`)
      .set(auth(adminId))
      .expect(200);
    expect(unlocked.body).toMatchObject({ id: otherMemberId, locked: false });
  });
});
