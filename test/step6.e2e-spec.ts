import { randomUUID } from 'node:crypto';
import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import request from 'supertest';
import { DataSource } from 'typeorm';
import type { Request } from 'express';
import { configureApp } from '../src/configure-app';
import { LocationController } from '../src/bounded-contexts/locations/presentation/http/location.controller';
import { FriendLiveLocationsController } from '../src/bounded-contexts/locations/presentation/http/friend-live-locations.controller';
import { PublishLocationUseCase } from '../src/bounded-contexts/locations/application/use-cases/publish-location.use-case';
import { GetLatestLocationQuery } from '../src/bounded-contexts/locations/application/queries/get-latest-location.query';
import { ListFriendLiveLocationsQuery } from '../src/bounded-contexts/locations/application/queries/list-friend-live-locations.query';
import { FriendLiveLocationFanoutService } from '../src/bounded-contexts/locations/application/services/friend-live-location-fanout.service';
import { LocationAccessService } from '../src/bounded-contexts/locations/application/services/location-access.service';
import {
  AuthLocationPrivacyAdapter,
  FriendsLocationAccessAdapter,
} from '../src/bounded-contexts/locations/infrastructure/adapters/location-access.adapters';
import { RedisLocationAdapter } from '../src/bounded-contexts/locations/infrastructure/adapters/redis-location.adapter';
import { RedisFriendLiveLocationThrottle } from '../src/bounded-contexts/locations/infrastructure/adapters/redis-friend-live-location-throttle';
import {
  NearbyDetector,
  normalizedPair,
} from '../src/bounded-contexts/nearby/application/nearby-detector';
import { RedisNearbyPairState } from '../src/bounded-contexts/nearby/infrastructure/redis-nearby-pair-state';
import { TypeOrmNearbyOutbox } from '../src/bounded-contexts/nearby/infrastructure/typeorm-nearby-outbox';
import { GetPrivacySettingsUseCase } from '../src/bounded-contexts/auth/application/use-cases/get-privacy-settings.use-case';
import { TypeOrmPrivacySettingsRepository } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/typeorm-privacy-settings-repository';
import { TypeOrmUserDirectory } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/typeorm-user-directory';
import { UserAccountEntity } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/entities/user-account.typeorm-entity';
import { PrivacySettingsEntity } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/entities/privacy-settings.typeorm-entity';
import { FriendshipReader } from '../src/bounded-contexts/friends/application/public/friendship-reader';
import { TypeOrmFriendshipRepository } from '../src/bounded-contexts/friends/infrastructure/persistence/typeorm/typeorm-friendship-repository';
import { FriendshipEntity } from '../src/bounded-contexts/friends/infrastructure/persistence/typeorm/entities/friendship.typeorm-entity';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { OutboxEventTypeOrmEntity } from '../src/infrastructure/outbox/persistence/outbox-event.typeorm-entity';
import { CreateAuthTables1760000001000 } from '../src/infrastructure/database/migrations/1760000001000-create-auth-tables';
import { CreateFriendshipsTable1760000003000 } from '../src/infrastructure/database/migrations/1760000003000-create-friendships-table';
import { CreatePrivacySettingsTable1760000004000 } from '../src/infrastructure/database/migrations/1760000004000-create-privacy-settings-table';
import { AddFriendLiveLocationEnabled1792300000000 } from '../src/infrastructure/database/migrations/1792300000000-add-friend-live-location-enabled';
import { CreateOutboxEventsTable1760000006000 } from '../src/infrastructure/database/migrations/1760000006000-create-outbox-events-table';
import { AccessTokenGuard } from '../src/presentation/http/guards/access-token.guard';
import { RolesGuard } from '../src/presentation/http/guards/roles.guard';

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
if (!databaseUrl || !redisUrl)
  throw new Error(
    'DATABASE_URL and REDIS_URL are required',
  );

describe('Step 6 nearby HTTP flow over PostgreSQL + Redis', () => {
  const schema = `step6_http_${randomUUID().replaceAll('-', '')}`;
  const alice = randomUUID();
  const bob = randomUUID();
  let bootstrap: DataSource;
  let db: DataSource;
  let redisClient: Redis;
  let redis: RedisService;
  let locations: RedisLocationAdapter;
  let app: INestApplication;
  const realtime = { publish: jest.fn().mockResolvedValue(undefined) };

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
        PrivacySettingsEntity,
        FriendshipEntity,
        OutboxEventTypeOrmEntity,
      ],
      migrations: [
        CreateAuthTables1760000001000,
        CreateFriendshipsTable1760000003000,
        CreatePrivacySettingsTable1760000004000,
        AddFriendLiveLocationEnabled1792300000000,
        CreateOutboxEventsTable1760000006000,
      ],
    }).initialize();
    await db.runMigrations();
    redisClient = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
    redis = new RedisService(redisClient);
    locations = new RedisLocationAdapter(redis);

    await db.query(
      `INSERT INTO user_accounts (id,email,display_name,created_at,updated_at)
       VALUES ($1,$2,'Alice',NOW(),NOW()),($3,$4,'Bob',NOW(),NOW())`,
      [alice, `${alice}@test.invalid`, bob, `${bob}@test.invalid`],
    );
    await db.query(
      `INSERT INTO privacy_settings
       (id,user_id,sharing_mode,is_location_sharing_enabled,use_approximate_location,nearby_feature_enabled,friend_live_location_enabled,selected_friend_ids,updated_at)
       VALUES ($1,$2,'friends',true,false,true,true,'{}',NOW()),($3,$4,'friends',true,false,true,true,'{}',NOW())`,
      [randomUUID(), alice, randomUUID(), bob],
    );
    const [userA, userB] = [alice, bob].sort();
    await db.query(
      `INSERT INTO friendships
       (id,user_a_id,user_b_id,requested_by_id,status,requested_at,updated_at,responded_at)
       VALUES ($1,$2,$3,$2,'accepted',NOW(),NOW(),NOW())`,
      [randomUUID(), userA, userB],
    );

    const privacyReader = new GetPrivacySettingsUseCase(
      new TypeOrmPrivacySettingsRepository(db),
      new TypeOrmUserDirectory(db),
    );
    const friendships = new FriendshipReader(
      new TypeOrmFriendshipRepository(db),
    );
    const access = new LocationAccessService(
      new AuthLocationPrivacyAdapter(privacyReader),
      new FriendsLocationAccessAdapter(friendships),
    );
    const nearby = new NearbyDetector(
      friendships,
      privacyReader,
      locations,
      new RedisNearbyPairState(redis),
      new TypeOrmNearbyOutbox(db),
    );
    const fixture = await Test.createTestingModule({
      controllers: [LocationController, FriendLiveLocationsController],
      providers: [
        {
          provide: ConfigService,
          useValue: new ConfigService({
            app: { apiPrefix: 'api/v1', swaggerEnabled: false },
          }),
        },
        {
          provide: PublishLocationUseCase,
          useValue: new PublishLocationUseCase(
            access,
            locations,
            nearby,
            new FriendLiveLocationFanoutService(
              friendships,
              locations,
              access,
              new RedisFriendLiveLocationThrottle(redis),
              realtime,
            ),
          ),
        },
        {
          provide: GetLatestLocationQuery,
          useValue: new GetLatestLocationQuery(access, locations),
        },
        {
          provide: ListFriendLiveLocationsQuery,
          useValue: new ListFriendLiveLocationsQuery(
            friendships,
            locations,
            access,
          ),
        },
        AccessTokenGuard,
        RolesGuard,
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const http = context
            .switchToHttp()
            .getRequest<
              Request & { user?: { id: string; roles: readonly ['user'] } }
            >();
          const id = http.headers.authorization?.replace('Bearer ', '');
          if (id !== alice && id !== bob) throw new UnauthorizedException();
          http.user = { id, roles: ['user'] };
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
    await locations?.remove(alice);
    await locations?.remove(bob);
    const pair = normalizedPair(alice, bob);
    if (redis) {
      await redis.del(`nearby-state:${pair}`);
      await redis.del(`nearby-cooldown:${pair}`);
    }
    if (redisClient) await redisClient.quit();
    if (db?.isInitialized) await db.destroy();
    if (bootstrap?.isInitialized) {
      await bootstrap.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await bootstrap.destroy();
    }
  });

  it('publishes a location, de-duplicates concurrent entry, and notifies again only after outside/re-entry', async () => {
    const now = new Date();
    await locations.save(bob, {
      latitude: 10.78,
      longitude: 106.69,
      accuracy: 10,
      recordedAt: now,
    });
    const publish = () =>
      request(app.getHttpServer())
        .post('/api/v1/locations')
        .set({ Authorization: `Bearer ${alice}` })
        .send({
          latitude: 10.77,
          longitude: 106.69,
          accuracy: 10,
          recordedAt: new Date().toISOString(),
        })
        .expect(200);
    await Promise.all(Array.from({ length: 8 }, publish));
    await expectNearbyEventCount(2);

    await locations.save(bob, {
      latitude: 11.1,
      longitude: 106.69,
      accuracy: 10,
      recordedAt: new Date(),
    });
    await publish();
    await expectNearbyEventCount(2);
    await redis.del(`nearby-cooldown:${normalizedPair(alice, bob)}`);
    await locations.save(bob, {
      latitude: 10.78,
      longitude: 106.69,
      accuracy: 10,
      recordedAt: new Date(),
    });
    await publish();
    await expectNearbyEventCount(4);

    const pair = normalizedPair(alice, bob);
    const resetPair = async () => {
      await redis.del(`nearby-state:${pair}`);
      await redis.del(`nearby-cooldown:${pair}`);
    };
    await db.query(
      `UPDATE privacy_settings SET nearby_feature_enabled=false WHERE user_id=$1`,
      [bob],
    );
    await resetPair();
    await publish();
    await expectNearbyEventCount(4);
    await db.query(
      `UPDATE privacy_settings SET nearby_feature_enabled=true WHERE user_id=$1`,
      [bob],
    );

    const [userA, userB] = [alice, bob].sort();
    await db.query(
      `UPDATE friendships SET status='pending', responded_at=NULL WHERE user_a_id=$1 AND user_b_id=$2`,
      [userA, userB],
    );
    await resetPair();
    await publish();
    await expectNearbyEventCount(4);
    await db.query(
      `UPDATE friendships SET status='accepted', responded_at=NOW() WHERE user_a_id=$1 AND user_b_id=$2`,
      [userA, userB],
    );

    await db.query(`UPDATE user_accounts SET is_locked=true WHERE id=$1`, [
      bob,
    ]);
    await resetPair();
    await publish();
    await expectNearbyEventCount(4);
    await db.query(`UPDATE user_accounts SET is_locked=false WHERE id=$1`, [
      bob,
    ]);
    await db.query(
      `UPDATE privacy_settings SET sharing_mode='off', is_location_sharing_enabled=false WHERE user_id=$1`,
      [bob],
    );
    await resetPair();
    await publish();
    await expectNearbyEventCount(4);
    await db.query(
      `UPDATE privacy_settings SET sharing_mode='friends', is_location_sharing_enabled=true WHERE user_id=$1`,
      [bob],
    );

    await locations.remove(bob);
    await resetPair();
    await publish();
    await expectNearbyEventCount(4);
    for (const sample of [
      { latitude: 10.78, recordedAt: new Date(Date.now() - 300_000) },
      { latitude: 10.78, recordedAt: new Date(Date.now() + 60_000) },
      { latitude: 91, recordedAt: new Date() },
    ]) {
      await locations.save(bob, {
        latitude: sample.latitude,
        longitude: 106.69,
        accuracy: 10,
        recordedAt: sample.recordedAt,
      });
      await resetPair();
      await publish();
      await expectNearbyEventCount(4);
    }

    const events = await db.getRepository(OutboxEventTypeOrmEntity).find({
      where: { eventName: 'NearbyFriendDetected.v1' },
    });
    expect(events.every((event) => event.destination === 'push')).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(
      /latitude|longitude|distance|address|token/i,
    );
  });

  it('returns only the authorized Redis snapshot and emits one redacted per-viewer friend delta', async () => {
    realtime.publish.mockClear();
    await redis.del(`friend-live-last:${alice.toLowerCase()}`);
    await request(app.getHttpServer())
      .post('/api/v1/locations')
      .set({ Authorization: `Bearer ${alice}` })
      .send({
        latitude: 10.77,
        longitude: 106.69,
        accuracy: 8,
        recordedAt: new Date().toISOString(),
      })
      .expect(200);
    expect(realtime.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        room: `user:${bob}`,
        eventName: 'friend:location:updated',
        payload: expect.objectContaining({ ownerId: alice }),
      }),
    );
    expect(JSON.stringify(realtime.publish.mock.calls)).not.toMatch(
      /token|address|distance/i,
    );
    await request(app.getHttpServer())
      .get('/api/v1/friends/live-locations')
      .set({ Authorization: `Bearer ${bob}` })
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual([
          expect.objectContaining({ ownerId: alice }),
        ]);
      });
    await db.query(
      `UPDATE privacy_settings SET sharing_mode='off', is_location_sharing_enabled=false WHERE user_id=$1`,
      [alice],
    );
    await request(app.getHttpServer())
      .get('/api/v1/friends/live-locations')
      .set({ Authorization: `Bearer ${bob}` })
      .expect(200, { items: [] });
    await db.query(
      `UPDATE privacy_settings SET sharing_mode='friends', is_location_sharing_enabled=true WHERE user_id=$1`,
      [alice],
    );
  });

  async function expectNearbyEventCount(expected: number) {
    const rows = await db.query<Array<{ count: number }>>(
      `SELECT count(*)::int AS count FROM outbox_events WHERE event_name='NearbyFriendDetected.v1'`,
    );
    expect(rows).toEqual([{ count: expected }]);
  }
});
