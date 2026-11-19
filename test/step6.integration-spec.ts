import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { RedisNearbyPairState } from '../src/bounded-contexts/nearby/infrastructure/redis-nearby-pair-state';
import { TypeOrmNearbyOutbox } from '../src/bounded-contexts/nearby/infrastructure/typeorm-nearby-outbox';
import { CreateOutboxEventsTable1760000006000 } from '../src/infrastructure/database/migrations/1760000006000-create-outbox-events-table';
import { OutboxEventTypeOrmEntity } from '../src/infrastructure/outbox/persistence/outbox-event.typeorm-entity';
import { RedisAiExplanationCache } from '../src/bounded-contexts/recommendations/infrastructure/adapters/redis-ai-explanation-cache';
import { CreateAuthTables1760000001000 } from '../src/infrastructure/database/migrations/1760000001000-create-auth-tables';
import { CreateFriendshipsTable1760000003000 } from '../src/infrastructure/database/migrations/1760000003000-create-friendships-table';
import { CreatePrivacySettingsTable1760000004000 } from '../src/infrastructure/database/migrations/1760000004000-create-privacy-settings-table';
import { AddFriendLiveLocationEnabled1792300000000 } from '../src/infrastructure/database/migrations/1792300000000-add-friend-live-location-enabled';
import { UserAccountEntity } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/entities/user-account.typeorm-entity';
import { PrivacySettingsEntity } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/entities/privacy-settings.typeorm-entity';
import { FriendshipEntity } from '../src/bounded-contexts/friends/infrastructure/persistence/typeorm/entities/friendship.typeorm-entity';
import { TypeOrmUserDirectory } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/typeorm-user-directory';
import { TypeOrmPrivacySettingsRepository } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/typeorm-privacy-settings-repository';
import { GetPrivacySettingsUseCase } from '../src/bounded-contexts/auth/application/use-cases/get-privacy-settings.use-case';
import { TypeOrmFriendshipRepository } from '../src/bounded-contexts/friends/infrastructure/persistence/typeorm/typeorm-friendship-repository';
import { FriendshipReader } from '../src/bounded-contexts/friends/application/public/friendship-reader';
import { RedisLocationAdapter } from '../src/bounded-contexts/locations/infrastructure/adapters/redis-location.adapter';
import {
  NearbyDetector,
  normalizedPair,
} from '../src/bounded-contexts/nearby/application/nearby-detector';
import { RedisFriendLiveLocationThrottle } from '../src/bounded-contexts/locations/infrastructure/adapters/redis-friend-live-location-throttle';

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
if (!databaseUrl || !redisUrl)
  throw new Error(
    'DATABASE_URL and REDIS_URL are required',
  );

describe('Step 6 PostgreSQL + Redis integration', () => {
  const schema = `step6_${randomUUID().replaceAll('-', '')}`;
  let bootstrap: DataSource;
  let db: DataSource;
  let redisClient: Redis;
  let redis: RedisService;

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
      synchronize: false,
    }).initialize();
    await db.runMigrations();
    redisClient = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
    redis = new RedisService(redisClient);
  });

  afterAll(async () => {
    if (redisClient) await redisClient.quit();
    if (db?.isInitialized) await db.destroy();
    if (bootstrap?.isInitialized) {
      await bootstrap.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await bootstrap.destroy();
    }
  });

  it('claims one normalized nearby transition under real concurrency and supports compensation/re-entry', async () => {
    const pairs = new RedisNearbyPairState(redis);
    const pair = `${randomUUID()}:${randomUUID()}`;
    const attempts = await Promise.all(
      Array.from({ length: 20 }, () =>
        pairs.transition(pair, true, randomUUID()),
      ),
    );
    expect(attempts.filter(Boolean)).toHaveLength(1);
    await pairs.transition(pair, false, randomUUID());
    expect(await pairs.transition(pair, true, randomUUID())).toBe(false);
    await redis.del(`nearby-cooldown:${pair}`);
    await pairs.transition(pair, false, randomUUID());
    expect(await pairs.transition(pair, true, randomUUID())).toBe(true);
  });

  it('writes two privacy-safe push events atomically', async () => {
    const outbox = new TypeOrmNearbyOutbox(db);
    const userAId = randomUUID();
    const userBId = randomUUID();
    await outbox.enqueue({
      eventIdA: randomUUID(),
      eventIdB: randomUUID(),
      userAId,
      userBId,
      occurredAt: new Date(),
    });
    const rows = await db
      .getRepository(OutboxEventTypeOrmEntity)
      .find({ order: { createdAt: 'ASC' } });
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.recipientIds)).toEqual([[userAId], [userBId]]);
    expect(JSON.stringify(rows)).not.toMatch(
      /latitude|longitude|distance|address|token/i,
    );
  });

  it('uses real account, friendship, privacy, location, Redis pair state and PostgreSQL outbox adapters', async () => {
    const alice = randomUUID();
    const bob = randomUUID();
    await db.query(
      `INSERT INTO user_accounts (id,email,display_name,created_at,updated_at) VALUES ($1,$2,'Alice',NOW(),NOW()),($3,$4,'Bob',NOW(),NOW())`,
      [alice, `${alice}@test.invalid`, bob, `${bob}@test.invalid`],
    );
    await db.query(
      `INSERT INTO privacy_settings (id,user_id,sharing_mode,is_location_sharing_enabled,use_approximate_location,nearby_feature_enabled,selected_friend_ids,updated_at) VALUES ($1,$2,'friends',true,false,true,'{}',NOW()),($3,$4,'friends',true,false,true,'{}',NOW())`,
      [randomUUID(), alice, randomUUID(), bob],
    );
    const [userA, userB] = [alice, bob].sort();
    await db.query(
      `INSERT INTO friendships (id,user_a_id,user_b_id,requested_by_id,status,requested_at,updated_at,responded_at) VALUES ($1,$2,$3,$2,'accepted',NOW(),NOW(),NOW())`,
      [randomUUID(), userA, userB],
    );
    const locations = new RedisLocationAdapter(redis);
    const now = new Date();
    await locations.save(alice, {
      latitude: 10.77,
      longitude: 106.69,
      accuracy: 10,
      recordedAt: now,
    });
    await locations.save(bob, {
      latitude: 10.78,
      longitude: 106.69,
      accuracy: 10,
      recordedAt: now,
    });
    const privacy = new GetPrivacySettingsUseCase(
      new TypeOrmPrivacySettingsRepository(db),
      new TypeOrmUserDirectory(db),
    );
    const detector = new NearbyDetector(
      new FriendshipReader(new TypeOrmFriendshipRepository(db)),
      privacy,
      locations,
      new RedisNearbyPairState(redis),
      new TypeOrmNearbyOutbox(db),
    );
    await Promise.all(
      Array.from({ length: 10 }, () => detector.detect(alice, now)),
    );
    const rows = await db.query<Array<{ count: number }>>(
      `SELECT count(*)::int AS count FROM outbox_events WHERE event_name='NearbyFriendDetected.v1' AND recipient_ids && ARRAY[$1,$2]::uuid[]`,
      [alice, bob],
    );
    expect(rows).toEqual([{ count: 2 }]);
    await detector.detect(bob, now);
    expect(
      (
        await db.query<Array<{ count: number }>>(
          `SELECT count(*)::int AS count FROM outbox_events WHERE event_name='NearbyFriendDetected.v1'`,
        )
      )[0]?.count,
    ).toBeGreaterThanOrEqual(2);
    await redis.del(`nearby-state:${normalizedPair(alice, bob)}`);
    await redis.del(`nearby-cooldown:${normalizedPair(alice, bob)}`);
    await locations.remove(alice);
    await locations.remove(bob);
  });

  it('round-trips AI cache with a bounded TTL and removes corrupt data', async () => {
    const cache = new RedisAiExplanationCache(redis);
    const key = randomUUID();
    await cache.set(key, { text: 'safe', factKeys: ['rank'] }, 86_400);
    await expect(cache.get(key)).resolves.toEqual({
      text: 'safe',
      factKeys: ['rank'],
    });
    expect(await redisClient.ttl(`ai-explanation:${key}`)).toBeGreaterThan(
      86_390,
    );
    await redis.set(`ai-explanation:${key}`, '{broken', 86_400);
    await expect(cache.get(key)).resolves.toBeNull();
    await expect(redis.get(`ai-explanation:${key}`)).resolves.toBeNull();
  });

  it('atomically throttles Friend Live Location on real Redis by time or 25m movement', async () => {
    const throttle = new RedisFriendLiveLocationThrottle(redis);
    const owner = randomUUID();
    const at = new Date('2026-11-16T00:00:00.000Z');
    const base = {
      latitude: 10.77,
      longitude: 106.69,
      accuracy: 8,
      recordedAt: at,
    };
    expect(await throttle.shouldEmit(owner, base)).toBe(true);
    expect(
      await throttle.shouldEmit(owner, {
        ...base,
        recordedAt: new Date(at.getTime() + 9_000),
      }),
    ).toBe(false);
    expect(
      await throttle.shouldEmit(owner, {
        ...base,
        latitude: 10.7703,
        recordedAt: new Date(at.getTime() + 9_001),
      }),
    ).toBe(true);
    const concurrentOwner = randomUUID();
    const outcomes = await Promise.all(
      Array.from({ length: 12 }, () =>
        throttle.shouldEmit(concurrentOwner, base),
      ),
    );
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    await redis.del(`friend-live-last:${owner.toLowerCase()}`);
    await redis.del(`friend-live-last:${concurrentOwner.toLowerCase()}`);
  });
});
