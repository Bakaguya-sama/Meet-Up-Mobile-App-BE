import { randomUUID } from 'node:crypto';
import {
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { GetPublicHandleUseCase } from '../src/bounded-contexts/auth/application/use-cases/get-public-handle.use-case';
import { RotatePublicHandleUseCase } from '../src/bounded-contexts/auth/application/use-cases/rotate-public-handle.use-case';
import { DisablePublicHandleUseCase } from '../src/bounded-contexts/auth/application/use-cases/disable-public-handle.use-case';
import { UserAccountEntity } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/entities/user-account.typeorm-entity';
import { TypeOrmAuthUnitOfWork } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/typeorm-auth-unit-of-work';
import { TypeOrmUserDirectory } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/typeorm-user-directory';
import { CreateFriendQrSessionUseCase } from '../src/bounded-contexts/friends/application/use-cases/create-friend-qr-session.use-case';
import { PreviewFriendQrSessionUseCase } from '../src/bounded-contexts/friends/application/use-cases/preview-friend-qr-session.use-case';
import { ResolveFriendQrSessionRecipientUseCase } from '../src/bounded-contexts/friends/application/use-cases/resolve-friend-qr-session-recipient.use-case';
import { RevokeFriendQrSessionUseCase } from '../src/bounded-contexts/friends/application/use-cases/revoke-friend-qr-session.use-case';
import { SendFriendRequestUseCase } from '../src/bounded-contexts/friends/application/use-cases/send-friend-request.use-case';
import { RespondFriendRequestUseCase } from '../src/bounded-contexts/friends/application/use-cases/respond-friend-request.use-case';
import { UnfriendUseCase } from '../src/bounded-contexts/friends/application/use-cases/unfriend.use-case';
import { ListFriendshipsQuery } from '../src/bounded-contexts/friends/application/queries/list-friendships.query';
import { ResolvePublicQrProfileQuery } from '../src/bounded-contexts/friends/application/queries/resolve-public-qr-profile.query';
import { SearchUsersQuery } from '../src/bounded-contexts/friends/application/queries/search-users.query';
import { FRIEND_USER_DIRECTORY } from '../src/bounded-contexts/friends/application/ports/user-directory.port';
import { AuthUserDirectoryAdapter } from '../src/bounded-contexts/friends/infrastructure/adapters/auth-user-directory.adapter';
import { FriendshipEntity } from '../src/bounded-contexts/friends/infrastructure/persistence/typeorm/entities/friendship.typeorm-entity';
import { RedisFriendQrSessionStore } from '../src/bounded-contexts/friends/infrastructure/persistence/redis/redis-friend-qr-session-store';
import { TypeOrmFriendshipRepository } from '../src/bounded-contexts/friends/infrastructure/persistence/typeorm/typeorm-friendship-repository';
import { FriendsController } from '../src/bounded-contexts/friends/presentation/http/friends.controller';
import { AcceptMeetupInviteLinkUseCase } from '../src/bounded-contexts/meetups/application/use-cases/accept-meetup-invite-link.use-case';
import { CreateMeetupInviteLinkUseCase } from '../src/bounded-contexts/meetups/application/use-cases/create-meetup-invite-link.use-case';
import { PreviewMeetupInviteLinkUseCase } from '../src/bounded-contexts/meetups/application/use-cases/preview-meetup-invite-link.use-case';
import { RevokeMeetupInviteLinkUseCase } from '../src/bounded-contexts/meetups/application/use-cases/revoke-meetup-invite-link.use-case';
import { MeetupInviteLinkEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/meetup-invite-link.typeorm-entity';
import { MeetupEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/meetup.typeorm-entity';
import { ParticipantPreferenceEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/participant-preference.typeorm-entity';
import { ParticipantEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/participant.typeorm-entity';
import { TypeOrmMeetupInviteLinkRepository } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/typeorm-meetup-invite-link.repository';
import {
  MeetupInviteLinkAcceptController,
  MeetupInviteLinkPreviewController,
  MeetupInviteLinksController,
} from '../src/bounded-contexts/meetups/presentation/http/meetup-invite-links.controller';
import { configureApp } from '../src/configure-app';
import { CreateAuthTables1760000001000 } from '../src/infrastructure/database/migrations/1760000001000-create-auth-tables';
import { CreateUserPreferencesTables1760000002000 } from '../src/infrastructure/database/migrations/1760000002000-create-user-preferences-tables';
import { CreateFriendshipsTable1760000003000 } from '../src/infrastructure/database/migrations/1760000003000-create-friendships-table';
import { CreateOutboxEventsTable1760000006000 } from '../src/infrastructure/database/migrations/1760000006000-create-outbox-events-table';
import { CreateMeetupsTables1792070000000 } from '../src/infrastructure/database/migrations/1792070000000-create-meetups-tables';
import { CreateMeetupParticipantPreferencesTable1792070001000 } from '../src/infrastructure/database/migrations/1792070001000-create-meetup-participant-preferences-table';
import { CreateMeetupInviteLinks1792120000000 } from '../src/infrastructure/database/migrations/1792120000000-create-meetup-invite-links';
import { AddPublicHandleToUserAccounts1792130000000 } from '../src/infrastructure/database/migrations/1792130000000-add-public-handle-to-user-accounts';
import { AddChatFavoritesAndAdminAudit1792140000000 } from '../src/infrastructure/database/migrations/1792140000000-add-chat-favorites-admin-audit';
import { OutboxEventTypeOrmEntity } from '../src/infrastructure/outbox/persistence/outbox-event.typeorm-entity';
import { RedisRateLimiter } from '../src/infrastructure/redis/redis-rate-limiter.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { AccessTokenGuard } from '../src/presentation/http/guards/access-token.guard';
import { RolesGuard } from '../src/presentation/http/guards/roles.guard';
import type { Request } from 'express';

jest.setTimeout(30000);
const databaseUrl = process.env.MEETUP_TEST_DATABASE_URL;
const redisUrl = process.env.MEETUP_TEST_REDIS_URL;
if (!databaseUrl || !redisUrl) {
  throw new Error(
    'MEETUP_TEST_DATABASE_URL and MEETUP_TEST_REDIS_URL are required for BE-33/BE-34 E2E tests',
  );
}

describe('BE-33/BE-34 HTTP with PostgreSQL and Redis', () => {
  const schema = `invite_qr_http_${randomUUID().replaceAll('-', '')}`;
  const organizerId = randomUUID();
  const bobId = randomUUID();
  const carolId = randomUUID();
  let bootstrap: DataSource;
  let db: DataSource;
  let redisClient: Redis;
  let app: INestApplication<App>;
  let meetupId: string;

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
        FriendshipEntity,
        MeetupEntity,
        ParticipantEntity,
        ParticipantPreferenceEntity,
        MeetupInviteLinkEntity,
        OutboxEventTypeOrmEntity,
      ],
      migrations: [
        CreateAuthTables1760000001000,
        CreateUserPreferencesTables1760000002000,
        CreateFriendshipsTable1760000003000,
        CreateOutboxEventsTable1760000006000,
        CreateMeetupsTables1792070000000,
        CreateMeetupParticipantPreferencesTable1792070001000,
        CreateMeetupInviteLinks1792120000000,
        AddPublicHandleToUserAccounts1792130000000,
        AddChatFavoritesAndAdminAudit1792140000000,
      ],
    }).initialize();
    await db.runMigrations();
    await db.query(
      `INSERT INTO user_accounts (id, email, display_name, created_at, updated_at)
       SELECT id, id::text || '@test.invalid', display_name, NOW(), NOW()
       FROM unnest($1::uuid[], $2::text[]) AS users(id, display_name)`,
      [
        [organizerId, bobId, carolId],
        ['Organizer', 'Bob', 'Carol'],
      ],
    );
    meetupId = randomUUID();
    await db.query(
      `INSERT INTO meetup_sessions (
         id, organizer_id, title, scheduled_at, invitation_deadline_at,
         search_radius_m, place_type, recommendation_mode, status, created_at, updated_at
       ) VALUES ($1, $2, 'HTTP meetup', NOW() + INTERVAL '2 hours',
         NOW() + INTERVAL '1 hour', 2000, 'cafe', 'balanced', 'inviting', NOW(), NOW())`,
      [meetupId, organizerId],
    );
    await db.query(
      `INSERT INTO meetup_participants (
         id, meetup_id, user_id, status, invited_by_id, responded_at, joined_at
       ) VALUES ($1, $2, $3, 'accepted', $3, NOW(), NOW())`,
      [randomUUID(), meetupId, organizerId],
    );

    redisClient = new Redis(redisUrl, { lazyConnect: false });
    await redisClient.flushdb();
    const redisService = new RedisService(redisClient);
    const qrStore = new RedisFriendQrSessionStore(redisService);
    const rateLimiter = new RedisRateLimiter(redisService);
    const config = new ConfigService({
      app: {
        apiPrefix: 'api/v1',
        swaggerEnabled: false,
        publicAppBaseUrl: 'https://app.example.test',
      },
      friendQr: { rateLimit: 1000, sessionTtlSeconds: 60 },
      meetupInvites: { rateLimit: 1000 },
    });
    const userDirectory = new AuthUserDirectoryAdapter(
      new TypeOrmUserDirectory(db),
    );
    const friendshipStore = new TypeOrmFriendshipRepository(db);
    const inviteStore = new TypeOrmMeetupInviteLinkRepository(db);
    const authUow = new TypeOrmAuthUnitOfWork(db);

    const fixture = await Test.createTestingModule({
      controllers: [
        FriendsController,
        MeetupInviteLinksController,
        MeetupInviteLinkPreviewController,
        MeetupInviteLinkAcceptController,
      ],
      providers: [
        { provide: ConfigService, useValue: config },
        { provide: RedisRateLimiter, useValue: rateLimiter },
        { provide: FRIEND_USER_DIRECTORY, useValue: userDirectory },
        {
          provide: GetPublicHandleUseCase,
          useValue: new GetPublicHandleUseCase(authUow),
        },
        {
          provide: RotatePublicHandleUseCase,
          useValue: new RotatePublicHandleUseCase(authUow),
        },
        {
          provide: DisablePublicHandleUseCase,
          useValue: new DisablePublicHandleUseCase(authUow),
        },
        {
          provide: CreateFriendQrSessionUseCase,
          useValue: new CreateFriendQrSessionUseCase(
            qrStore,
            60,
            'https://app.example.test',
          ),
        },
        {
          provide: PreviewFriendQrSessionUseCase,
          useValue: new PreviewFriendQrSessionUseCase(
            qrStore,
            friendshipStore,
            userDirectory,
          ),
        },
        {
          provide: ResolveFriendQrSessionRecipientUseCase,
          useValue: new ResolveFriendQrSessionRecipientUseCase(
            qrStore,
            userDirectory,
          ),
        },
        {
          provide: RevokeFriendQrSessionUseCase,
          useValue: new RevokeFriendQrSessionUseCase(qrStore),
        },
        {
          provide: SendFriendRequestUseCase,
          useValue: new SendFriendRequestUseCase(
            friendshipStore,
            userDirectory,
          ),
        },
        {
          provide: RespondFriendRequestUseCase,
          useValue: new RespondFriendRequestUseCase(friendshipStore),
        },
        {
          provide: SearchUsersQuery,
          useValue: new SearchUsersQuery(friendshipStore, userDirectory),
        },
        {
          provide: ListFriendshipsQuery,
          useValue: new ListFriendshipsQuery(friendshipStore, userDirectory),
        },
        {
          provide: ResolvePublicQrProfileQuery,
          useValue: new ResolvePublicQrProfileQuery(
            friendshipStore,
            userDirectory,
          ),
        },
        {
          provide: UnfriendUseCase,
          useValue: new UnfriendUseCase(friendshipStore, {
            removeFromOwnerSelection: () => Promise.resolve(),
          }),
        },
        {
          provide: CreateMeetupInviteLinkUseCase,
          useValue: new CreateMeetupInviteLinkUseCase(
            inviteStore,
            'https://app.example.test',
          ),
        },
        {
          provide: PreviewMeetupInviteLinkUseCase,
          useValue: new PreviewMeetupInviteLinkUseCase(inviteStore),
        },
        {
          provide: AcceptMeetupInviteLinkUseCase,
          useValue: new AcceptMeetupInviteLinkUseCase(inviteStore),
        },
        {
          provide: RevokeMeetupInviteLinkUseCase,
          useValue: new RevokeMeetupInviteLinkUseCase(inviteStore),
        },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context
            .switchToHttp()
            .getRequest<Request & { user: { id: string } }>();
          const id = req.headers.authorization?.replace('Bearer ', '');
          if (!id || ![organizerId, bobId, carolId].includes(id))
            throw new UnauthorizedException();
          req.user = { id };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (redisClient) {
      await redisClient.flushdb();
      await redisClient.quit();
    }
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

  it('creates, previews, accepts idempotently and revokes an invite link over HTTP', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/invite-links`)
      .set(auth(organizerId))
      .send({ expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() })
      .expect(201);
    const inviteUrl = responseString(created, 'inviteUrl');
    const inviteId = responseString(created, 'id');
    const token = inviteUrl.split('/').at(-1)!;
    await request(app.getHttpServer())
      .get(`/api/v1/meetup-invites/${token}/preview`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ title: 'HTTP meetup' });
        expect(body).not.toHaveProperty('participants');
        expect(body).not.toHaveProperty('location');
        expect(body).not.toHaveProperty('preferences');
      });
    await request(app.getHttpServer())
      .post(`/api/v1/meetup-invites/${token}/accept`)
      .set(auth(bobId))
      .expect(200, { meetupId, status: 'accepted', alreadyMember: false });
    await request(app.getHttpServer())
      .post(`/api/v1/meetup-invites/${token}/accept`)
      .set(auth(bobId))
      .expect(200, { meetupId, status: 'accepted', alreadyMember: true });
    await request(app.getHttpServer())
      .delete(`/api/v1/meetups/${meetupId}/invite-links/${inviteId}`)
      .set(auth(organizerId))
      .expect(204);
    await request(app.getHttpServer())
      .get(`/api/v1/meetup-invites/${token}/preview`)
      .expect(404);
  });

  it('validates invite expiry and organizer authorization', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/invite-links`)
      .set(auth(organizerId))
      .send({ expiresAt: 'not-a-date' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/invite-links`)
      .set(auth(carolId))
      .send({ expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString() })
      .expect(404);
  });

  it('uses stable and temporary QR selectors without exposing internal IDs', async () => {
    const stable = await request(app.getHttpServer())
      .post('/api/v1/friends/public-handle/rotate')
      .set(auth(carolId))
      .expect(200);
    const publicHandle = responseString(stable, 'publicHandle');
    await request(app.getHttpServer())
      .get(`/api/v1/friends/qr-profiles/${publicHandle}`)
      .set(auth(organizerId))
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ displayName: 'Carol', friendship: null });
        expect(body).not.toHaveProperty('id');
        expect(body).not.toHaveProperty('userAccountId');
      });
    await request(app.getHttpServer())
      .post('/api/v1/friends/requests')
      .set(auth(organizerId))
      .send({ recipientPublicHandle: publicHandle })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({ status: 'pending' });
        expect(body).not.toHaveProperty('userAId');
        expect(body).not.toHaveProperty('userBId');
      });

    const temporary = await request(app.getHttpServer())
      .post('/api/v1/friends/qr-sessions')
      .set(auth(bobId))
      .expect(201);
    const qrUrl = responseString(temporary, 'qrUrl');
    const sessionId = responseString(temporary, 'sessionId');
    const token = qrUrl.split('/').at(-1)!;
    await request(app.getHttpServer())
      .get(`/api/v1/friends/qr-sessions/${token}`)
      .set(auth(organizerId))
      .expect(200, { displayName: 'Bob', avatarUrl: null, friendship: null });
    await request(app.getHttpServer())
      .post('/api/v1/friends/requests')
      .set(auth(organizerId))
      .send({ qrSessionToken: token })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/v1/friends/qr-sessions/${sessionId}`)
      .set(auth(bobId))
      .expect(204);
    await request(app.getHttpServer())
      .get(`/api/v1/friends/qr-sessions/${token}`)
      .set(auth(organizerId))
      .expect(404);
  });

  it('rejects zero/multiple selectors, self requests and duplicates', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/friends/requests')
      .set(auth(organizerId))
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/friends/requests')
      .set(auth(organizerId))
      .send({ recipientId: bobId, recipientPublicHandle: 'a'.repeat(43) })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/friends/requests')
      .set(auth(organizerId))
      .send({ recipientId: organizerId })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/friends/requests')
      .set(auth(organizerId))
      .send({ recipientId: bobId })
      .expect(409);
  });
});
