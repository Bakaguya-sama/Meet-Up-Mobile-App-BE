import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '../src/configure-app';
import { FriendsController } from '../src/bounded-contexts/friends/presentation/http/friends.controller';
import { AccessTokenGuard } from '../src/presentation/http/guards/access-token.guard';
import { RolesGuard } from '../src/presentation/http/guards/roles.guard';
import { SendFriendRequestUseCase } from '../src/bounded-contexts/friends/application/use-cases/send-friend-request.use-case';
import { RespondFriendRequestUseCase } from '../src/bounded-contexts/friends/application/use-cases/respond-friend-request.use-case';
import { UnfriendUseCase } from '../src/bounded-contexts/friends/application/use-cases/unfriend.use-case';
import { SearchUsersQuery } from '../src/bounded-contexts/friends/application/queries/search-users.query';
import { ListFriendshipsQuery } from '../src/bounded-contexts/friends/application/queries/list-friendships.query';
import { ResolvePublicQrProfileQuery } from '../src/bounded-contexts/friends/application/queries/resolve-public-qr-profile.query';
import { ManagePublicHandleUseCase } from '../src/bounded-contexts/auth/application/use-cases/manage-public-handle.use-case';
import { FRIEND_USER_DIRECTORY } from '../src/bounded-contexts/friends/application/ports/user-directory.port';
import { CreateFriendQrSessionUseCase } from '../src/bounded-contexts/friends/application/use-cases/create-friend-qr-session.use-case';
import { ManageFriendQrSessionUseCase } from '../src/bounded-contexts/friends/application/use-cases/manage-friend-qr-session.use-case';
import { RedisRateLimiter } from '../src/infrastructure/redis/redis-rate-limiter.service';
import type { FriendUserDirectoryPort } from '../src/bounded-contexts/friends/application/ports/user-directory.port';
import { InMemoryFriendshipStore } from './support/in-memory-friendship-store';

describe('Friends HTTP contract', () => {
  const alice = 'aaaaaaaa-0000-4000-8000-000000000001';
  const bob = 'bbbbbbbb-0000-4000-8000-000000000002';
  const carol = 'cccccccc-0000-4000-8000-000000000003';
  let app: INestApplication<App>;
  let store: InMemoryFriendshipStore;
  let users: jest.Mocked<FriendUserDirectoryPort>;

  beforeAll(async () => {
    store = new InMemoryFriendshipStore();
    const profiles = [alice, bob, carol].map((id) => ({
      id,
      displayName: id,
      avatarUrl: null,
    }));
    users = {
      findActiveByIds: jest.fn((ids: string[]) =>
        Promise.resolve(profiles.filter((user) => ids.includes(user.id))),
      ),
      findActiveByPublicHandle: jest.fn().mockResolvedValue(profiles[1]),
      search: jest.fn().mockResolvedValue({ items: [profiles[1]], total: 1 }),
    };
    const publicHandle = {
      current: jest.fn().mockResolvedValue({ publicHandle: 'a'.repeat(43) }),
      rotate: jest.fn().mockResolvedValue({ publicHandle: 'b'.repeat(43) }),
      disable: jest.fn().mockResolvedValue(undefined),
    };
    const qrSessions = {
      preview: jest.fn(),
      revoke: jest.fn(),
      resolveRecipientId: jest.fn().mockResolvedValue(bob),
    };
    const rateLimiter = {
      assertAllowed: jest.fn().mockResolvedValue(undefined),
    };
    const fixture = await Test.createTestingModule({
      controllers: [FriendsController],
      providers: [
        {
          provide: ConfigService,
          useValue: new ConfigService({
            app: { apiPrefix: 'api/v1', swaggerEnabled: false },
            friendQr: { rateLimit: 10 },
          }),
        },
        {
          provide: SendFriendRequestUseCase,
          useValue: new SendFriendRequestUseCase(store, users),
        },
        {
          provide: RespondFriendRequestUseCase,
          useValue: new RespondFriendRequestUseCase(store),
        },
        {
          provide: UnfriendUseCase,
          useValue: new UnfriendUseCase(store, {
            removeFromOwnerSelection: () => Promise.resolve(),
          }),
        },
        {
          provide: SearchUsersQuery,
          useValue: new SearchUsersQuery(store, users),
        },
        {
          provide: ListFriendshipsQuery,
          useValue: new ListFriendshipsQuery(store, users),
        },
        { provide: ManagePublicHandleUseCase, useValue: publicHandle },
        {
          provide: ResolvePublicQrProfileQuery,
          useValue: new ResolvePublicQrProfileQuery(store, users),
        },
        { provide: FRIEND_USER_DIRECTORY, useValue: users },
        {
          provide: CreateFriendQrSessionUseCase,
          useValue: { execute: jest.fn() },
        },
        { provide: ManageFriendQrSessionUseCase, useValue: qrSessions },
        { provide: RedisRateLimiter, useValue: rateLimiter },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context
            .switchToHttp()
            .getRequest<Request & { user: { id: string } }>();
          const id = req.headers.authorization?.replace('Bearer ', '');
          if (!id || ![alice, bob, carol].includes(id))
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

  beforeEach(() => store.rows.clear());
  afterAll(async () => {
    await app?.close();
  });

  const auth = (id: string) => ({ Authorization: `Bearer ${id}` });
  async function send() {
    const response = await request(app.getHttpServer())
      .post('/api/v1/friends/requests')
      .set(auth(alice))
      .send({ recipientId: bob })
      .expect(201);
    return (response.body as { id: string }).id;
  }

  it.each(['/friends', '/friends/search?q=Bob', '/friends/requests'])(
    'requires authentication for GET %s',
    async (path) => {
      await request(app.getHttpServer()).get(`/api/v1${path}`).expect(401);
    },
  );

  it('validates pagination, search, UUIDs and rejects actor spoofing', async () => {
    for (const query of [
      'q=',
      'q=%20%20',
      'q=Bob&limit=0',
      'q=Bob&limit=51',
      'q=Bob&offset=-1',
      'q=Bob&limit=no',
      'q=Bob&limit=1.5',
      'q=Bob&actorId=spoofed',
    ]) {
      await request(app.getHttpServer())
        .get(`/api/v1/friends/search?${query}`)
        .set(auth(alice))
        .expect(400);
    }
    for (const body of [
      { recipientId: 'invalid' },
      { recipientId: alice.toUpperCase() },
      { recipientId: bob, actorId: carol },
    ]) {
      await request(app.getHttpServer())
        .post('/api/v1/friends/requests')
        .set(auth(alice))
        .send(body)
        .expect(400);
    }
    await request(app.getHttpServer())
      .get('/api/v1/friends/requests?direction=invalid')
      .set(auth(alice))
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/friends/requests/invalid/accept')
      .set(auth(bob))
      .expect(400);
  });

  it('returns the current public handle for the signed-in account', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/friends/public-handle')
      .set(auth(alice))
      .expect(200, { publicHandle: 'a'.repeat(43) });
  });

  it('resolves a temporary QR then uses the existing friend-request flow', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/friends/requests')
      .set(auth(alice))
      .send({ qrSessionToken: 't'.repeat(43) })
      .expect(201);

    expect(response.body).toMatchObject({ status: 'pending' });
    expect(response.body).toHaveProperty('requestedAt');
    expect(response.body).not.toHaveProperty('userAId');
  });

  it('returns search results with defaults and relationship state', async () => {
    await send();
    const response = await request(app.getHttpServer())
      .get('/api/v1/friends/search?q=%20Bob%20')
      .set(auth(alice))
      .expect(200);
    expect(users.search.mock.calls.at(-1)?.[0]).toEqual({
      actorId: alice,
      query: 'Bob',
      offset: 0,
      limit: 20,
    });
    expect(response.body).toMatchObject({
      total: 1,
      items: [
        { id: bob, friendship: { requestedById: alice, status: 'pending' } },
      ],
    });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('lists both request directions, then shows acceptance to both users', async () => {
    const id = await send();
    for (const [actor, direction] of [
      [alice, 'sent'],
      [bob, 'received'],
    ]) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/friends/requests?direction=${direction}`)
        .set(auth(actor))
        .expect(200);
      expect(response.body).toMatchObject({ total: 1, items: [{ id }] });
    }
    await request(app.getHttpServer())
      .post(`/api/v1/friends/requests/${id}/accept`)
      .set(auth(bob))
      .expect(200);
    for (const actor of [alice, bob]) {
      const response = await request(app.getHttpServer())
        .get('/api/v1/friends')
        .set(auth(actor))
        .expect(200);
      expect(response.body).toMatchObject({
        total: 1,
        items: [{ id, status: 'accepted' }],
      });
    }
    const pending = await request(app.getHttpServer())
      .get('/api/v1/friends/requests')
      .set(auth(bob))
      .expect(200);
    expect(pending.body).toMatchObject({ total: 0, items: [] });
  });

  it('rejects duplicates in either direction and prevents unauthorized responses', async () => {
    const id = await send();
    for (const [actor, recipientId] of [
      [alice, bob],
      [bob, alice],
    ]) {
      await request(app.getHttpServer())
        .post('/api/v1/friends/requests')
        .set(auth(actor))
        .send({ recipientId })
        .expect(409);
    }
    await request(app.getHttpServer())
      .post(`/api/v1/friends/requests/${id}/accept`)
      .set(auth(alice))
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/friends/requests/${id}/reject`)
      .set(auth(carol))
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/friends/requests/${carol}/reject`)
      .set(auth(bob))
      .expect(404);
    expect(store.rows.get(id)?.status).toBe('pending');
  });

  it('closes rejected requests and rejects subsequent responses or duplicate invitations', async () => {
    const id = await send();
    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/friends/requests/${id}/reject`)
      .set(auth(bob))
      .expect(200);
    expect(rejected.body).toMatchObject({ status: 'rejected' });
    await request(app.getHttpServer())
      .post(`/api/v1/friends/requests/${id}/accept`)
      .set(auth(bob))
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/v1/friends/requests')
      .set(auth(alice))
      .send({ recipientId: bob })
      .expect(409);
    const friends = await request(app.getHttpServer())
      .get('/api/v1/friends')
      .set(auth(alice))
      .expect(200);
    expect(friends.body).toMatchObject({ total: 0 });
  });

  it('returns 404 for an unavailable recipient', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/friends/requests')
      .set(auth(alice))
      .send({ recipientId: 'dddddddd-0000-4000-8000-000000000004' })
      .expect(404);
  });

  it('removes an accepted friendship and returns 204', async () => {
    const id = await send();
    await request(app.getHttpServer())
      .post(`/api/v1/friends/requests/${id}/accept`)
      .set(auth(bob))
      .expect(200);

    // Either party can unfriend
    await request(app.getHttpServer())
      .delete(`/api/v1/friends/${id}`)
      .set(auth(alice))
      .expect(204);

    // Friendship no longer appears in the list
    const friends = await request(app.getHttpServer())
      .get('/api/v1/friends')
      .set(auth(alice))
      .expect(200);
    expect(friends.body).toMatchObject({ total: 0, items: [] });
  });

  it('rejects unfriend on a pending or non-existent friendship', async () => {
    const id = await send();
    // Pending — not accepted
    await request(app.getHttpServer())
      .delete(`/api/v1/friends/${id}`)
      .set(auth(alice))
      .expect(409);
    // Non-existent
    await request(app.getHttpServer())
      .delete(`/api/v1/friends/${carol}`)
      .set(auth(alice))
      .expect(404);
    // Invalid UUID
    await request(app.getHttpServer())
      .delete('/api/v1/friends/not-a-uuid')
      .set(auth(alice))
      .expect(400);
  });
});
