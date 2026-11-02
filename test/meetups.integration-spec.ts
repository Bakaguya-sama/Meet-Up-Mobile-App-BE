import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { CreateAuthTables1760000001000 } from '../src/infrastructure/database/migrations/1760000001000-create-auth-tables';
import { CreateUserPreferencesTables1760000002000 } from '../src/infrastructure/database/migrations/1760000002000-create-user-preferences-tables';
import { CreateMeetupParticipantPreferencesTable1792070001000 } from '../src/infrastructure/database/migrations/1792070001000-create-meetup-participant-preferences-table';
import { ParticipantPreferenceEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/participant-preference.typeorm-entity';
import { CreateFriendshipsTable1760000003000 } from '../src/infrastructure/database/migrations/1760000003000-create-friendships-table';
import { CreateOutboxEventsTable1760000006000 } from '../src/infrastructure/database/migrations/1760000006000-create-outbox-events-table';
import { CreateMeetupsTables1792070000000 } from '../src/infrastructure/database/migrations/1792070000000-create-meetups-tables';
import { MeetupEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/meetup.typeorm-entity';
import { ParticipantEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/participant.typeorm-entity';
import { TypeOrmMeetupRepository } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/typeorm-meetup-repository';
import { OutboxEventTypeOrmEntity } from '../src/infrastructure/outbox/persistence/outbox-event.typeorm-entity';
import { Meetup } from '../src/bounded-contexts/meetups/domain/aggregates/meetup.aggregate';
import { isIntegrationEvent } from '../src/shared-kernel/application/integration-event.contract';
import { FriendshipEntity } from '../src/bounded-contexts/friends/infrastructure/persistence/typeorm/entities/friendship.typeorm-entity';
import { TypeOrmFriendshipRepository } from '../src/bounded-contexts/friends/infrastructure/persistence/typeorm/typeorm-friendship-repository';
import { FriendshipReader } from '../src/bounded-contexts/friends/application/public/friendship-reader';
import { UserAccountEntity } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/entities/user-account.typeorm-entity';
import { TypeOrmUserDirectory } from '../src/bounded-contexts/auth/infrastructure/persistence/typeorm/typeorm-user-directory';
import { InviteeEligibilityAdapter } from '../src/bounded-contexts/meetups/infrastructure/adapters/invitee-eligibility.adapter';

const databaseUrl = process.env.MEETUP_TEST_DATABASE_URL;
// Always create an isolated schema; never fall back to the application's DATABASE_URL.
const integration = databaseUrl ? describe : describe.skip;

integration('Meetup PostgreSQL transactions and migrations', () => {
  const schema = `meetup_test_${randomUUID().replaceAll('-', '')}`;
  const alice = randomUUID(),
    bob = randomUUID(),
    carol = randomUUID();
  let bootstrap: DataSource;
  let db: DataSource;
  let store: TypeOrmMeetupRepository;

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
        MeetupEntity,
        ParticipantEntity,
        ParticipantPreferenceEntity,
        OutboxEventTypeOrmEntity,
        FriendshipEntity,
        UserAccountEntity,
      ],
      migrations: [
        CreateAuthTables1760000001000,
        CreateUserPreferencesTables1760000002000,
        CreateFriendshipsTable1760000003000,
        CreateOutboxEventsTable1760000006000,
        CreateMeetupsTables1792070000000,
        CreateMeetupParticipantPreferencesTable1792070001000,
      ],
    }).initialize();
    await db.runMigrations();
    // Prove the new migration is reversible before inserting fixtures.
    await db.undoLastMigration();
    await db.runMigrations();
    store = new TypeOrmMeetupRepository(db);
    await seedUsers([alice, bob, carol]);
  });

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (bootstrap?.isInitialized) {
      await bootstrap.query(`DROP SCHEMA "${schema}" CASCADE`);
      await bootstrap.destroy();
    }
  });

  async function seedUsers(ids: string[]) {
    await db.query(
      `INSERT INTO user_accounts (id, email, display_name, created_at, updated_at) SELECT id, id::text || '@test.invalid', 'Test', NOW(), NOW() FROM unnest($1::uuid[]) AS id`,
      [ids],
    );
  }
  function aggregate(inviteeIds = [bob]) {
    return Meetup.create(
      {
        id: randomUUID(),
        organizerId: alice,
        organizerParticipantId: randomUUID(),
        title: 'Coffee',
        description: null,
        scheduledAt: new Date(Date.now() + 7200000),
        invitationDeadlineAt: new Date(Date.now() + 3600000),
        placeType: 'cafe',
        searchRadiusM: 5000,
        recommendationMode: 'balanced',
        invitees: inviteeIds.map((userId) => ({ id: randomUUID(), userId })),
      },
      new Date(),
    );
  }
  async function create() {
    const meetup = aggregate();
    await store.insert(meetup);
    return meetup.snapshot().id;
  }
  const deliveries = (id: string) =>
    db
      .getRepository(OutboxEventTypeOrmEntity)
      .createQueryBuilder('event')
      .where("event.payload->>'meetupId' = :id", { id })
      .getMany();

  it('persists and maps fields, participants and valid events together', async () => {
    const id = await create();
    const state = await store.findVisible(id, alice);
    expect(state).toMatchObject({
      id,
      status: 'inviting',
      recommendationMode: 'balanced',
      placeType: 'cafe',
    });
    expect(state?.participants).toHaveLength(2);
    const events = await deliveries(id);
    expect(events).toHaveLength(2);
    expect(events.every((event) => isIntegrationEvent(event.payload))).toBe(
      true,
    );
    expect(await store.findVisible(id, carol)).toBeNull();
  });

  it('persists selected preferences, preserves them on reinvite and clears them transactionally', async () => {
    const id = await create();
    await store.updateLocked(id, (meetup) =>
      meetup.respond(bob, 'accepted', new Date()),
    );
    await store.updateLocked(id, (meetup) =>
      meetup.setParticipantPreferences(
        bob,
        [{ activityTagId: 1, level: 'avoid' }],
        new Date(),
      ),
    );
    await store.updateLocked(id, (meetup) => meetup.leave(bob, new Date()));
    await store.updateLocked(id, (meetup) =>
      meetup.invite(alice, [{ id: randomUUID(), userId: bob }], new Date()),
    );
    const member = (await store.findVisible(id, alice))!.participants.find(
      (p) => p.userId === bob,
    )!;
    expect(member.preferences).toMatchObject([
      { activityTagId: 1, level: 'avoid' },
    ]);
    await store.updateLocked(id, (meetup) =>
      meetup.setParticipantPreferences(bob, [], new Date()),
    );
    expect(
      (await store.findVisible(id, alice))!.participants.find(
        (p) => p.userId === bob,
      )!.preferences,
    ).toEqual([]);
  });

  it('serializes competing accept/reject and emits exactly one response event', async () => {
    const id = await create();
    const results = await Promise.allSettled([
      store.updateLocked(id, (meetup) =>
        meetup.respond(bob, 'accepted', new Date()),
      ),
      store.updateLocked(id, (meetup) =>
        meetup.respond(bob, 'declined', new Date()),
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(
      (await deliveries(id)).filter(
        (event) => event.eventName === 'MeetupMemberChanged.v1',
      ),
    ).toHaveLength(1);
  });

  it('serializes cancellation against acceptance and always revokes active access', async () => {
    const id = await create();
    const results = await Promise.allSettled([
      store.updateLocked(id, (meetup) => meetup.cancel(alice, new Date())),
      store.updateLocked(id, (meetup) =>
        meetup.respond(bob, 'accepted', new Date()),
      ),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect((await store.findVisible(id, alice))?.status).toBe('cancelled');
    expect(await store.areAcceptedInActiveMeetup(id, [alice, bob])).toBe(false);
  });

  it('rolls back membership if outbox persistence fails', async () => {
    const id = await create();
    await db.query(
      `ALTER TABLE outbox_events ADD CONSTRAINT test_reject_member_event CHECK (event_name <> 'MeetupMemberChanged.v1') NOT VALID`,
    );
    try {
      await expect(
        store.updateLocked(id, (meetup) =>
          meetup.respond(bob, 'accepted', new Date()),
        ),
      ).rejects.toThrow();
      expect(
        (await store.findVisible(id, alice))?.participants.find(
          (p) => p.userId === bob,
        )?.status,
      ).toBe('invited');
      expect(await deliveries(id)).toHaveLength(2);
    } finally {
      await db.query(
        'ALTER TABLE outbox_events DROP CONSTRAINT test_reject_member_event',
      );
    }
  });

  it('rolls back creation and all participants if outbox insertion fails', async () => {
    const meetup = aggregate();
    await db.query(
      `ALTER TABLE outbox_events ADD CONSTRAINT test_reject_create_event CHECK (event_name <> 'MeetupCreated.v1') NOT VALID`,
    );
    try {
      await expect(store.insert(meetup)).rejects.toThrow();
      expect(
        await db
          .getRepository(MeetupEntity)
          .countBy({ id: meetup.snapshot().id }),
      ).toBe(0);
      expect(
        await db
          .getRepository(ParticipantEntity)
          .countBy({ meetupId: meetup.snapshot().id }),
      ).toBe(0);
    } finally {
      await db.query(
        'ALTER TABLE outbox_events DROP CONSTRAINT test_reject_create_event',
      );
    }
  });

  it('serializes reinvitations without duplicate participants or duplicate events', async () => {
    const id = await create();
    await store.updateLocked(id, (meetup) =>
      meetup.respond(bob, 'declined', new Date()),
    );
    const results = await Promise.allSettled(
      Array.from({ length: 2 }, () =>
        store.updateLocked(id, (meetup) =>
          meetup.invite(alice, [{ id: randomUUID(), userId: bob }], new Date()),
        ),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await db.getRepository(ParticipantEntity).countBy({ meetupId: id }),
    ).toBe(2);
    expect(
      (await deliveries(id)).filter(
        (row) => row.payload.membershipStatus === 'invited',
      ),
    ).toHaveLength(2);
  });

  it('uses current accepted membership for both people and excludes departed users from reads', async () => {
    const id = await create();
    expect(await store.areAcceptedInActiveMeetup(id, [alice, bob])).toBe(false);
    await store.updateLocked(id, (meetup) =>
      meetup.respond(bob, 'accepted', new Date()),
    );
    expect(await store.areAcceptedInActiveMeetup(id, [alice, bob])).toBe(true);
    expect(await store.areAcceptedInActiveMeetup(id, [alice, carol])).toBe(
      false,
    );
    await store.updateLocked(id, (meetup) => meetup.leave(bob, new Date()));
    expect(await store.areAcceptedInActiveMeetup(id, [alice, bob])).toBe(false);
    expect(await store.findVisible(id, bob)).toBeNull();
    const page = await store.listVisible({
      actorId: bob,
      offset: 0,
      limit: 100,
    });
    expect(page.items.map((item) => item.id)).not.toContain(id);
  });

  it('supports more than 500 invitees without SQL parameter or product limits', async () => {
    const invitees = Array.from({ length: 501 }, () => randomUUID());
    await seedUsers(invitees);
    const meetup = aggregate(invitees);
    await store.insert(meetup);
    expect(
      (await store.findVisible(meetup.snapshot().id, alice))?.participants,
    ).toHaveLength(502);
  });

  it('checks accepted friendships and active accounts through public APIs', async () => {
    const [userAId, userBId] = [alice, bob].sort();
    await db.manager.insert(FriendshipEntity, {
      id: randomUUID(),
      userAId,
      userBId,
      requestedById: alice,
      status: 'accepted',
      requestedAt: new Date(),
      respondedAt: new Date(),
      updatedAt: new Date(),
    });
    const eligibility = new InviteeEligibilityAdapter(
      new FriendshipReader(new TypeOrmFriendshipRepository(db)),
      new TypeOrmUserDirectory(db),
    );
    expect(await eligibility.eligibleIds(alice, [bob, carol])).toEqual([bob]);
    await db.manager.update(UserAccountEntity, bob, { isLocked: true });
    try {
      expect(await eligibility.eligibleIds(alice, [bob])).toEqual([]);
    } finally {
      await db.manager.update(UserAccountEntity, bob, { isLocked: false });
    }
  });

  it('enforces membership uniqueness at database level', async () => {
    const id = await create();
    const participant = await db
      .getRepository(ParticipantEntity)
      .findOneByOrFail({ meetupId: id, userId: bob });
    await expect(
      db.manager.insert(ParticipantEntity, {
        ...participant,
        id: randomUUID(),
      }),
    ).rejects.toMatchObject({ driverError: { code: '23505' } });
  });
});
