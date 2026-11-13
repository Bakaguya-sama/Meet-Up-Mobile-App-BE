import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
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
import { AuthUserDirectoryAdapter } from '../src/bounded-contexts/friends/infrastructure/adapters/auth-user-directory.adapter';
import { FriendshipEntity } from '../src/bounded-contexts/friends/infrastructure/persistence/typeorm/entities/friendship.typeorm-entity';
import { RedisFriendQrSessionStore } from '../src/bounded-contexts/friends/infrastructure/persistence/redis/redis-friend-qr-session-store';
import { TypeOrmFriendshipRepository } from '../src/bounded-contexts/friends/infrastructure/persistence/typeorm/typeorm-friendship-repository';
import { MeetupInviteLinkToken } from '../src/bounded-contexts/meetups/domain/aggregates/meetup-invite-link';
import { MeetupInviteLinkEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/meetup-invite-link.typeorm-entity';
import { MeetupEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/meetup.typeorm-entity';
import { ParticipantPreferenceEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/participant-preference.typeorm-entity';
import { ParticipantEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/participant.typeorm-entity';
import { TypeOrmMeetupInviteLinkRepository } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/typeorm-meetup-invite-link.repository';
import { CreateAuthTables1760000001000 } from '../src/infrastructure/database/migrations/1760000001000-create-auth-tables';
import { CreateUserPreferencesTables1760000002000 } from '../src/infrastructure/database/migrations/1760000002000-create-user-preferences-tables';
import { CreateFriendshipsTable1760000003000 } from '../src/infrastructure/database/migrations/1760000003000-create-friendships-table';
import { CreateOutboxEventsTable1760000006000 } from '../src/infrastructure/database/migrations/1760000006000-create-outbox-events-table';
import { CreateMeetupsTables1792070000000 } from '../src/infrastructure/database/migrations/1792070000000-create-meetups-tables';
import { CreateMeetupParticipantPreferencesTable1792070001000 } from '../src/infrastructure/database/migrations/1792070001000-create-meetup-participant-preferences-table';
import { CreateRecommendationRunBaseline1792080000000 } from '../src/infrastructure/database/migrations/1792080000000-create-recommendation-run-baseline';
import { AddRecommendationRankingSnapshots1792090000000 } from '../src/infrastructure/database/migrations/1792090000000-add-recommendation-ranking-snapshots';
import { AddRecommendationTemporalContext1792100000000 } from '../src/infrastructure/database/migrations/1792100000000-add-recommendation-temporal-context';
import { CreateRecommendationResults1792110000000 } from '../src/infrastructure/database/migrations/1792110000000-create-recommendation-results';
import { CreateMeetupInviteLinks1792120000000 } from '../src/infrastructure/database/migrations/1792120000000-create-meetup-invite-links';
import { AddPublicHandleToUserAccounts1792130000000 } from '../src/infrastructure/database/migrations/1792130000000-add-public-handle-to-user-accounts';
import { AddChatFavoritesAndAdminAudit1792140000000 } from '../src/infrastructure/database/migrations/1792140000000-add-chat-favorites-admin-audit';
import { AddMeetupVoting1792150000000 } from '../src/infrastructure/database/migrations/1792150000000-add-meetup-voting';
import { OutboxEventTypeOrmEntity } from '../src/infrastructure/outbox/persistence/outbox-event.typeorm-entity';
import { RedisRateLimiter } from '../src/infrastructure/redis/redis-rate-limiter.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';

const databaseUrl = process.env.MEETUP_TEST_DATABASE_URL;
const redisUrl = process.env.MEETUP_TEST_REDIS_URL;
if (!databaseUrl || !redisUrl) {
  throw new Error(
    'MEETUP_TEST_DATABASE_URL and MEETUP_TEST_REDIS_URL are required for BE-33/BE-34 integration tests',
  );
}

describe('BE-33/BE-34 PostgreSQL and Redis integration', () => {
  const schema = `invite_qr_${randomUUID().replaceAll('-', '')}`;
  const organizerId = randomUUID();
  const bobId = randomUUID();
  const carolId = randomUUID();
  let bootstrap: DataSource;
  let db: DataSource;
  let redisClient: Redis;
  let redisService: RedisService;
  let inviteLinks: TypeOrmMeetupInviteLinkRepository;
  let qrStore: RedisFriendQrSessionStore;

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
      synchronize: false,
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
        CreateRecommendationRunBaseline1792080000000,
        AddRecommendationRankingSnapshots1792090000000,
        AddRecommendationTemporalContext1792100000000,
        CreateRecommendationResults1792110000000,
        CreateMeetupInviteLinks1792120000000,
        AddPublicHandleToUserAccounts1792130000000,
        AddChatFavoritesAndAdminAudit1792140000000,
        AddMeetupVoting1792150000000,
      ],
    }).initialize();

    await db.runMigrations();
    expect(await hasColumn('user_accounts', 'public_handle')).toBe(true);
    expect(await hasTable('meetup_invite_links')).toBe(true);
    await db.undoLastMigration();
    await db.undoLastMigration();
    await db.undoLastMigration();
    await db.undoLastMigration();
    expect(await hasColumn('user_accounts', 'public_handle')).toBe(false);
    expect(await hasTable('meetup_invite_links')).toBe(false);
    await db.runMigrations();
    expect(await hasColumn('user_accounts', 'public_handle')).toBe(true);
    expect(await hasTable('meetup_invite_links')).toBe(true);

    await seedUsers();
    inviteLinks = new TypeOrmMeetupInviteLinkRepository(db);
    redisClient = new Redis(redisUrl, { lazyConnect: false });
    await redisClient.flushdb();
    redisService = new RedisService(redisClient);
    qrStore = new RedisFriendQrSessionStore(redisService);
  });

  afterAll(async () => {
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

  async function hasTable(tableName: string): Promise<boolean> {
    const [{ exists }] = await db.query<Array<{ exists: boolean }>>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2)`,
      [schema, tableName],
    );
    return exists;
  }

  async function hasColumn(
    tableName: string,
    columnName: string,
  ): Promise<boolean> {
    const [{ exists }] = await db.query<Array<{ exists: boolean }>>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3)`,
      [schema, tableName, columnName],
    );
    return exists;
  }

  async function seedUsers() {
    await db.query(
      `INSERT INTO user_accounts (id, email, display_name, created_at, updated_at)
       SELECT id, id::text || '@test.invalid', display_name, NOW(), NOW()
       FROM unnest($1::uuid[], $2::text[]) AS users(id, display_name)`,
      [
        [organizerId, bobId, carolId],
        ['Organizer', 'Bob', 'Carol'],
      ],
    );
  }

  async function seedMeetup(status = 'inviting') {
    const meetupId = randomUUID();
    const organizerParticipantId = randomUUID();
    await db.query(
      `INSERT INTO meetup_sessions (
         id, organizer_id, title, scheduled_at, invitation_deadline_at,
         search_radius_m, place_type, recommendation_mode, status,
         cancelled_at, created_at, updated_at
       ) VALUES ($1, $2, 'Coffee meetup', NOW() + INTERVAL '2 hours',
         NOW() + INTERVAL '1 hour', 2000, 'cafe', 'balanced', $3::meetup_status,
         CASE WHEN $3::text = 'cancelled' THEN NOW() ELSE NULL END, NOW(), NOW())`,
      [meetupId, organizerId, status],
    );
    await db.query(
      `INSERT INTO meetup_participants (
         id, meetup_id, user_id, status, invited_by_id, responded_at, joined_at
       ) VALUES ($1, $2, $3, 'accepted', $3, NOW(), NOW())`,
      [organizerParticipantId, meetupId, organizerId],
    );
    return meetupId;
  }

  async function createLink(meetupId: string, revokePrevious = false) {
    const token = MeetupInviteLinkToken.issue();
    const row = await inviteLinks.create({
      id: randomUUID(),
      meetupId,
      actorId: organizerId,
      tokenHash: token.tokenHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      revokePrevious,
      now: new Date(),
    });
    return { ...token, ...row };
  }

  it('runs invite/public-handle migrations through up, down, up with matching schema', async () => {
    const inviteColumns = await db.query<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'meetup_invite_links'`,
      [schema],
    );
    expect(inviteColumns.map((row) => row.column_name).sort()).toEqual(
      [
        'created_at',
        'created_by_id',
        'expires_at',
        'id',
        'last_used_at',
        'meetup_id',
        'revoked_at',
        'revoked_by_id',
        'token_hash',
        'updated_at',
        'use_count',
      ].sort(),
    );
  });

  it('supports multi-actor acceptance and same-actor idempotency without leaking raw tokens', async () => {
    const meetupId = await seedMeetup();
    const link = await createLink(meetupId);
    expect(
      await inviteLinks.findPreview(link.tokenHash, new Date()),
    ).toMatchObject({
      title: 'Coffee meetup',
    });

    expect(
      (
        await inviteLinks.accept({
          tokenHash: link.tokenHash,
          actorId: bobId,
          now: new Date(),
        })
      ).acceptedNow,
    ).toBe(true);
    expect(
      (
        await inviteLinks.accept({
          tokenHash: link.tokenHash,
          actorId: carolId,
          now: new Date(),
        })
      ).acceptedNow,
    ).toBe(true);
    expect(
      (
        await inviteLinks.accept({
          tokenHash: link.tokenHash,
          actorId: bobId,
          now: new Date(),
        })
      ).acceptedNow,
    ).toBe(false);

    const stored = await db
      .getRepository(MeetupInviteLinkEntity)
      .findOneByOrFail({ id: link.id });
    expect(stored.useCount).toBe(2);
    expect(stored.tokenHash).not.toBe(link.rawToken);
    const events = await db.getRepository(OutboxEventTypeOrmEntity).findBy({
      eventName: 'MeetupInviteLinkAccepted.v1',
    });
    const matching = events.filter(
      (event) => event.payload.meetupId === meetupId,
    );
    expect(matching).toHaveLength(2);
    expect(JSON.stringify(matching)).not.toContain(link.rawToken);
    expect(JSON.stringify(matching)).not.toContain(link.tokenHash);
  });

  it('serializes concurrent same-actor accepts and revoke/accept races', async () => {
    const meetupId = await seedMeetup();
    const sameActorLink = await createLink(meetupId);
    const concurrent = await Promise.all([
      inviteLinks.accept({
        tokenHash: sameActorLink.tokenHash,
        actorId: bobId,
        now: new Date(),
      }),
      inviteLinks.accept({
        tokenHash: sameActorLink.tokenHash,
        actorId: bobId,
        now: new Date(),
      }),
    ]);
    expect(concurrent.filter((result) => result.acceptedNow)).toHaveLength(1);
    expect(
      (
        await db
          .getRepository(MeetupInviteLinkEntity)
          .findOneByOrFail({ id: sameActorLink.id })
      ).useCount,
    ).toBe(1);

    const raceMeetupId = await seedMeetup();
    const raceLink = await createLink(raceMeetupId);
    const race = await Promise.allSettled([
      inviteLinks.accept({
        tokenHash: raceLink.tokenHash,
        actorId: carolId,
        now: new Date(),
      }),
      inviteLinks.revoke({
        meetupId: raceMeetupId,
        linkId: raceLink.id,
        actorId: organizerId,
        now: new Date(),
      }),
    ]);
    expect(race[1].status).toBe('fulfilled');
    const participantCounts = await db.query<Array<{ count: number }>>(
      `SELECT COUNT(*)::int AS count FROM meetup_participants WHERE meetup_id = $1 AND user_id = $2`,
      [raceMeetupId, carolId],
    );
    const participantCount = participantCounts[0]?.count ?? 0;
    const accepted = race[0].status === 'fulfilled';
    expect(participantCount).toBe(accepted ? 1 : 0);
  });

  it('rejects wrong, expired, revoked and locked meetup links without adding participants', async () => {
    const meetupId = await seedMeetup();
    const revoked = await createLink(meetupId);
    await inviteLinks.revoke({
      meetupId,
      linkId: revoked.id,
      actorId: organizerId,
      now: new Date(),
    });
    await expect(
      inviteLinks.accept({
        tokenHash: revoked.tokenHash,
        actorId: bobId,
        now: new Date(),
      }),
    ).rejects.toThrow('Invite link is unavailable');
    await expect(
      inviteLinks.accept({
        tokenHash: '0'.repeat(64),
        actorId: bobId,
        now: new Date(),
      }),
    ).rejects.toThrow('Invite link is unavailable');

    const expired = MeetupInviteLinkToken.issue();
    await db.query(
      `INSERT INTO meetup_invite_links (id, meetup_id, created_by_id, token_hash, expires_at, use_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW() - INTERVAL '1 second', 0, NOW(), NOW())`,
      [randomUUID(), meetupId, organizerId, expired.tokenHash],
    );
    await expect(
      inviteLinks.accept({
        tokenHash: expired.tokenHash,
        actorId: bobId,
        now: new Date(),
      }),
    ).rejects.toThrow('Invite link is unavailable');

    const lockedMeetupId = await seedMeetup('cancelled');
    const lockedToken = MeetupInviteLinkToken.issue();
    await db.query(
      `INSERT INTO meetup_invite_links (id, meetup_id, created_by_id, token_hash, expires_at, use_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 minutes', 0, NOW(), NOW())`,
      [randomUUID(), lockedMeetupId, organizerId, lockedToken.tokenHash],
    );
    await expect(
      inviteLinks.accept({
        tokenHash: lockedToken.tokenHash,
        actorId: bobId,
        now: new Date(),
      }),
    ).rejects.toThrow();
  });

  it('rotates/disables stable handles and makes old handles unresolvable', async () => {
    const uow = new TypeOrmAuthUnitOfWork(db);
    const get = new GetPublicHandleUseCase(uow);
    const rotate = new RotatePublicHandleUseCase(uow);
    const disable = new DisablePublicHandleUseCase(uow);
    const directory = new TypeOrmUserDirectory(db);

    expect(await get.execute(bobId)).toEqual({ publicHandle: null });
    const first = await rotate.execute(bobId);
    expect(
      (await directory.findActiveByPublicHandle(first.publicHandle))?.id,
    ).toBe(bobId);
    const second = await rotate.execute(bobId);
    expect(second.publicHandle).not.toBe(first.publicHandle);
    expect(
      await directory.findActiveByPublicHandle(first.publicHandle),
    ).toBeNull();
    await disable.execute(bobId);
    expect(await get.execute(bobId)).toEqual({ publicHandle: null });
    expect(
      await directory.findActiveByPublicHandle(second.publicHandle),
    ).toBeNull();
  });

  it('stores only hashed temporary tokens, resolves profiles, revokes and expires sessions', async () => {
    const directory = new AuthUserDirectoryAdapter(
      new TypeOrmUserDirectory(db),
    );
    const friendships = new TypeOrmFriendshipRepository(db);
    const create = new CreateFriendQrSessionUseCase(
      qrStore,
      1,
      'https://app.example.test',
    );
    const preview = new PreviewFriendQrSessionUseCase(
      qrStore,
      friendships,
      directory,
    );
    const resolveRecipient = new ResolveFriendQrSessionRecipientUseCase(
      qrStore,
      directory,
    );
    const revoke = new RevokeFriendQrSessionUseCase(qrStore);

    const first = await create.execute(bobId);
    const rawToken = first.qrUrl.split('/').at(-1)!;
    expect(await preview.execute(organizerId, rawToken)).toMatchObject({
      displayName: 'Bob',
      friendship: null,
    });
    expect(await resolveRecipient.execute(rawToken)).toBe(bobId);
    const keys = await redisClient.keys('friend-qr:v1:*');
    expect(keys.join('|')).not.toContain(rawToken);
    const values = await Promise.all(keys.map((key) => redisClient.get(key)));
    expect(JSON.stringify(values)).not.toContain(rawToken);
    await expect(revoke.execute(carolId, first.sessionId)).rejects.toThrow(
      'QR session is unavailable',
    );
    await revoke.execute(bobId, first.sessionId);
    await expect(preview.execute(organizerId, rawToken)).rejects.toThrow(
      'QR session is unavailable',
    );

    const expiring = await create.execute(bobId);
    const expiringToken = expiring.qrUrl.split('/').at(-1)!;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await expect(resolveRecipient.execute(expiringToken)).rejects.toThrow(
      'QR session is unavailable',
    );
    expect(await redisClient.keys('friend-qr:v1:*')).toHaveLength(0);
  });

  it('enforces Redis rate limits without storing raw token identities', async () => {
    const limiter = new RedisRateLimiter(redisService);
    const rawIdentity = `raw-${randomUUID()}`;
    await limiter.assertAllowed('friend-qr:test', rawIdentity, 1);
    await expect(
      limiter.assertAllowed('friend-qr:test', rawIdentity, 1),
    ).rejects.toMatchObject({ status: 429 });
    const keys = await redisClient.keys('rate-limit:v1:friend-qr:test:*');
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain(rawIdentity);
  });
});
