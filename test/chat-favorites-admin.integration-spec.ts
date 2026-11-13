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
import { ChatConversationEntity } from '../src/bounded-contexts/chat/infrastructure/persistence/typeorm/entities/chat-conversation.typeorm-entity';
import { ChatConversationMemberEntity } from '../src/bounded-contexts/chat/infrastructure/persistence/typeorm/entities/chat-conversation-member.typeorm-entity';
import { ChatMessageEntity } from '../src/bounded-contexts/chat/infrastructure/persistence/typeorm/entities/chat-message.typeorm-entity';
import { ChatMessageAttachmentEntity } from '../src/bounded-contexts/chat/infrastructure/persistence/typeorm/entities/chat-message-attachment.typeorm-entity';
import { TypeOrmMeetupChatStore } from '../src/bounded-contexts/chat/infrastructure/persistence/typeorm/typeorm-meetup-chat-store';
import { TypeOrmDirectChatStore } from '../src/bounded-contexts/chat/infrastructure/persistence/typeorm/typeorm-direct-chat-store';
import { MeetupMembershipReader } from '../src/bounded-contexts/meetups/application/public/meetup-membership-reader';
import { MeetupScheduleReader } from '../src/bounded-contexts/meetups/application/public/meetup-schedule-reader';
import { ListMeetupHistoryQuery } from '../src/bounded-contexts/meetups/application/queries/list-meetup-history.query';
import { CastMeetupVoteUseCase } from '../src/bounded-contexts/meetups/application/use-cases/cast-meetup-vote.use-case';
import { FinalizeMeetupUseCase } from '../src/bounded-contexts/meetups/application/use-cases/finalize-meetup.use-case';
import { VoteWinnerDomainService } from '../src/bounded-contexts/meetups/domain/services/vote-winner.domain-service';
import { MeetupEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/meetup.typeorm-entity';
import { ParticipantEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/participant.typeorm-entity';
import { ParticipantPreferenceEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/participant-preference.typeorm-entity';
import { MeetupVoteEntity } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/entities/meetup-vote.typeorm-entity';
import { TypeOrmMeetupRepository } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/typeorm-meetup-repository';
import { TypeOrmMeetupVotingUnitOfWork } from '../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/typeorm-meetup-voting-unit-of-work';
import { TypeOrmFavoritePlaceStore } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/typeorm-favorite-place-store';
import { FavoritePlaceEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/favorite-place.typeorm-entity';
import { RecommendationCandidateEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-candidate.typeorm-entity';
import { RecommendationRunEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-run.typeorm-entity';
import { RecommendationMemberFeatureEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-member-feature.typeorm-entity';
import { RecommendationPlaceEntity } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/entities/recommendation-place.typeorm-entity';
import { TypeOrmRecommendationHistoryReader } from '../src/bounded-contexts/recommendations/infrastructure/adapters/typeorm-recommendation-history-reader';
import { TypeOrmRecommendationVotingReader } from '../src/bounded-contexts/recommendations/infrastructure/adapters/typeorm-recommendation-voting-reader';
import { RecommendationRunFreshnessGuard } from '../src/bounded-contexts/recommendations/application/public/recommendation-run-freshness.guard';
import { GetRecommendationRunUseCase } from '../src/bounded-contexts/recommendations/application/use-cases/get-recommendation-run.use-case';
import { TypeOrmRecommendationRunRepository } from '../src/bounded-contexts/recommendations/infrastructure/persistence/typeorm/typeorm-recommendation-run.repository';
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
import { AddPublicHandleToUserAccounts1792130000000 } from '../src/infrastructure/database/migrations/1792130000000-add-public-handle-to-user-accounts';
import { AddChatFavoritesAndAdminAudit1792140000000 } from '../src/infrastructure/database/migrations/1792140000000-add-chat-favorites-admin-audit';
import { AddMeetupVoting1792150000000 } from '../src/infrastructure/database/migrations/1792150000000-add-meetup-voting';
import { EnforceMeetupChatAccess1792150000000 } from '../src/infrastructure/database/migrations/1792150000000-enforce-meetup-chat-access';
import { AddRecommendationTrafficWeatherContext1792160000000 } from '../src/infrastructure/database/migrations/1792160000000-add-recommendation-traffic-weather-context';
import { AddRecommendationStaticDurationMetric1792170000000 } from '../src/infrastructure/database/migrations/1792170000000-add-recommendation-static-duration-metric';
import { AddRecommendationClosingSnapshots1792180000000 } from '../src/infrastructure/database/migrations/1792180000000-add-recommendation-closing-snapshots';
import { AddDirectChatAndAttachments1792190000000 } from '../src/infrastructure/database/migrations/1792190000000-add-direct-chat-and-attachments';
import { UnifyChatConversations1792200000000 } from '../src/infrastructure/database/migrations/1792200000000-unify-chat-conversations';
import { CreateRecommendationFeedbackEvents1792210000000 } from '../src/infrastructure/database/migrations/1792210000000-create-recommendation-feedback-events';
import { CreateRecommendationRetentionHolds1792220000000 } from '../src/infrastructure/database/migrations/1792220000000-create-recommendation-retention-holds';
import { OutboxEventTypeOrmEntity } from '../src/infrastructure/outbox/persistence/outbox-event.typeorm-entity';

const databaseUrl = process.env.MEETUP_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('MEETUP_TEST_DATABASE_URL is required');

describe('BE-10, BE-11, BE-12, BE-19 and BE-20 PostgreSQL integration', () => {
  const schema = `chat_favorite_admin_${randomUUID().replaceAll('-', '')}`;
  const aliceId = randomUUID();
  const bobId = randomUUID();
  const outsiderId = randomUUID();
  const lateJoinerId = randomUUID();
  const meetupId = randomUUID();
  const runId = randomUUID();
  const candidateId = randomUUID();
  const canonicalCandidateKey = `google-places:${'x'.repeat(286)}`;
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
        MeetupVoteEntity,
        RecommendationRunEntity,
        RecommendationCandidateEntity,
        RecommendationMemberFeatureEntity,
        RecommendationPlaceEntity,
        FavoritePlaceEntity,
        ChatConversationEntity,
        ChatConversationMemberEntity,
        ChatMessageEntity,
        ChatMessageAttachmentEntity,
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
        AddPublicHandleToUserAccounts1792130000000,
        AddChatFavoritesAndAdminAudit1792140000000,
        AddMeetupVoting1792150000000,
        EnforceMeetupChatAccess1792150000000,
        AddRecommendationTrafficWeatherContext1792160000000,
        AddRecommendationStaticDurationMetric1792170000000,
        AddRecommendationClosingSnapshots1792180000000,
        AddDirectChatAndAttachments1792190000000,
        UnifyChatConversations1792200000000,
        CreateRecommendationFeedbackEvents1792210000000,
        CreateRecommendationRetentionHolds1792220000000,
      ],
    }).initialize();
    await db.runMigrations();
    await expectUnifiedSchema(true);
    // Undo the complete Step-5 tail as well, so this preserves the original
    // migration-cycle assertion for the unified-chat migration.
    await db.undoLastMigration();
    await db.undoLastMigration();
    await db.undoLastMigration();
    await expectUnifiedSchema(false);
    await db.runMigrations();
    await expectUnifiedSchema(true);

    await db.query(
      `INSERT INTO user_accounts (id, email, display_name, role, created_at, updated_at)
       SELECT id, id::text || '@test.invalid', display_name, role, NOW(), NOW()
       FROM unnest($1::uuid[], $2::text[], $3::varchar[]) AS users(id, display_name, role)`,
      [
        [aliceId, bobId, outsiderId, lateJoinerId],
        ['Alice', 'Bob', 'Outsider', 'Late joiner'],
        ['user', 'user', 'admin', 'user'],
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
    send = new SendMeetupChatMessageUseCase(chatStore, membership);
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

  async function expectUnifiedSchema(expected: boolean) {
    await expect(
      db.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = 'chat_messages'`,
        [schema],
      ),
    ).resolves.toEqual(expected ? [{ table_name: 'chat_messages' }] : []);
  }

  it('retains former-member history only through leftAt, rejects their writes atomically, and excludes them from new realtime delivery', async () => {
    const historicalId = randomUUID();
    await chatStore.append({
      id: historicalId,
      meetupId,
      senderUserId: aliceId,
      clientMessageId: randomUUID(),
      textContent: 'before departure',
      sentAt: new Date(Date.now() - 120_000),
      attachments: [],
    });
    await db.query(
      `UPDATE meetup_participants
       SET status = 'left', left_at = NOW()
       WHERE meetup_id = $1 AND user_id = $2`,
      [meetupId, bobId],
    );
    const sentAt = new Date();
    await expect(
      chatStore.append({
        id: randomUUID(),
        meetupId,
        senderUserId: bobId,
        clientMessageId: randomUUID(),
        textContent: 'must not be stored',
        sentAt,
        attachments: [],
      }),
    ).rejects.toMatchObject({
      code: 'CHAT_FORBIDDEN',
    } satisfies Partial<ChatError>);

    const newMessage = await send.execute({
      actorId: aliceId,
      meetupId,
      clientMessageId: randomUUID(),
      text: 'after departure',
    });
    const history = await list.execute({ actorId: bobId, meetupId, limit: 50 });
    expect(history.map((message) => message.id)).toEqual([historicalId]);
    await expect(
      send.execute({
        actorId: bobId,
        meetupId,
        clientMessageId: randomUUID(),
        text: 'forbidden',
      }),
    ).rejects.toMatchObject({ code: 'CHAT_FORBIDDEN' });
    const outbox = await db.query<
      Array<{ payload: Record<string, unknown>; recipient_ids: string[] }>
    >(
      `SELECT payload, recipient_ids FROM outbox_events
       WHERE event_name = 'MeetupChatMessageCreated.v1' AND payload->>'messageId' = $1`,
      [newMessage.id],
    );
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.recipient_ids).toEqual([aliceId]);
    expect(outbox[0]?.payload).toMatchObject({
      messageId: newMessage.id,
      conversationId: newMessage.conversationId,
      meetupId,
    });
    expect(outbox[0]?.payload).not.toHaveProperty('attachments');
    expect(outbox[0]?.payload).not.toHaveProperty('downloadUrl');
    await expect(
      list.execute({ actorId: outsiderId, meetupId, limit: 50 }),
    ).rejects.toMatchObject({ code: 'CHAT_FORBIDDEN' });
  });

  it('lets a newly accepted meetup member read the complete earlier history', async () => {
    const beforeJoinId = randomUUID();
    await chatStore.append({
      id: beforeJoinId,
      meetupId,
      senderUserId: aliceId,
      clientMessageId: randomUUID(),
      textContent: 'created before late join',
      sentAt: new Date(),
      attachments: [],
    });
    await db.query(
      `INSERT INTO meetup_participants (
         id, meetup_id, user_id, status, invited_by_id, responded_at, joined_at
       ) VALUES ($1, $2, $3, 'accepted', $4, NOW(), NOW())`,
      [randomUUID(), meetupId, lateJoinerId, aliceId],
    );
    const history = await list.execute({
      actorId: lateJoinerId,
      meetupId,
      limit: 100,
    });
    expect(history.map((message) => message.id)).toContain(beforeJoinId);
  });

  it('keeps direct history readable after block and de-duplicates client retries', async () => {
    const [userAId, userBId] = [aliceId, lateJoinerId].sort();
    await db.query(
      `INSERT INTO friendships (
         id, user_a_id, user_b_id, requested_by_id, status,
         requested_at, responded_at, updated_at
       ) VALUES ($1, $2, $3, $2, 'accepted', NOW(), NOW(), NOW())`,
      [randomUUID(), userAId, userBId],
    );
    const store = new TypeOrmDirectChatStore(db);
    const clientMessageId = randomUUID();
    const input = {
      id: randomUUID(),
      senderUserId: aliceId,
      recipientUserId: lateJoinerId,
      clientMessageId,
      textContent: '',
      sentAt: new Date(),
      attachments: [
        {
          storageProvider: 'cloudinary' as const,
          storageKey: `chat/direct/${userAId}/${userBId}/${clientMessageId}/0-test`,
          resourceType: 'raw' as const,
          format: 'pdf',
          fileName: 'plan.pdf',
          mimeType: 'application/pdf',
          bytes: 5,
        },
      ],
    };
    const [first, retried] = await Promise.all([
      store.append(input),
      store.append({ ...input, id: randomUUID() }),
    ]);
    expect(retried.id).toBe(first.id);
    await db.query(
      `UPDATE friendships SET status = 'blocked', responded_at = NOW(), updated_at = NOW()
       WHERE user_a_id = $1 AND user_b_id = $2`,
      [userAId, userBId],
    );
    const history = await store.list({
      actorId: aliceId,
      peerId: lateJoinerId,
      limit: 20,
    });
    expect(history.map((message) => message.id)).toEqual([first.id]);
    await expect(
      store.append({
        ...input,
        id: randomUUID(),
        clientMessageId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'DIRECT_CHAT_FORBIDDEN' });
    const count = await db.query<Array<{ count: string }>>(
      `SELECT count(*)::text AS count FROM chat_messages
       WHERE conversation_id = $1 AND sender_user_id = $2`,
      [first.conversationId, aliceId],
    );
    expect(count).toEqual([{ count: '1' }]);
    const attachmentCount = await db.query<Array<{ count: string }>>(
      `SELECT count(*)::text AS count FROM chat_message_attachments
       WHERE message_id = $1`,
      [first.id],
    );
    expect(attachmentCount).toEqual([{ count: '1' }]);
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

  async function createVotingScenario() {
    const scenarioMeetupId = randomUUID();
    const scenarioRunId = randomUUID();
    const firstCandidateId = randomUUID();
    const secondCandidateId = randomUUID();
    const firstPlaceId = randomUUID();
    const secondPlaceId = randomUUID();
    const aliceParticipantId = randomUUID();
    const bobParticipantId = randomUUID();
    const scheduledAt = new Date(Date.now() + 7_200_000);
    const voteDeadlineAt = new Date(Date.now() + 3_600_000);

    await db.query(
      `INSERT INTO meetup_sessions (
         id, organizer_id, title, scheduled_at, invitation_deadline_at, vote_deadline_at,
         search_radius_m, place_type, recommendation_mode, status, created_at, updated_at
       ) VALUES ($1, $2, 'Voting meetup', $3, $4, $5, 1000, 'cafe', 'balanced', 'choosing', NOW(), NOW())`,
      [
        scenarioMeetupId,
        aliceId,
        scheduledAt,
        new Date(Date.now() + 1_800_000),
        voteDeadlineAt,
      ],
    );
    await db.query(
      `INSERT INTO meetup_participants (
         id, meetup_id, user_id, status, invited_by_id, responded_at, joined_at
       ) VALUES
         ($1, $3, $4, 'accepted', $4, NOW(), NOW()),
         ($2, $3, $5, 'accepted', $4, NOW(), NOW())`,
      [aliceParticipantId, bobParticipantId, scenarioMeetupId, aliceId, bobId],
    );
    await db.query(
      `INSERT INTO recommendation_runs (
         id, meetup_id, request_id, payload_hash, requested_by_id, requested_k, status,
         ranking_strategy, algorithm_version, config_version, feature_schema_version,
         provider_mapping_version, provider_request_options_version, opening_filter,
         opening_evaluator_version, requested_at, scheduled_at_snapshot, created_at,
         completed_at, effective_k, warnings, random_seed, route_batch_count,
         route_element_count, routing_preference_requested, routing_preference_effective,
         weather_policy_requested, weather_policy_effective, weather_policy_version,
         closing_policy_version
       ) VALUES (
         $1, $2, $3, $4, $5, 2, 'COMPLETED', 'fair-pareto-v1', 'engine-v1',
         'config-v1', 'features-v1', 'mapping-v1', 'request-v1', 'ANY', 'not-applied',
         NOW(), $6, NOW(), NOW(), 2, '[]'::jsonb, 'seed', 1, 4,
         'TRAFFIC_UNAWARE', 'TRAFFIC_UNAWARE', 'OFF', 'OFF', 'weather-off-v1',
         'closing-policy-off-v1'
       )`,
      [
        scenarioRunId,
        scenarioMeetupId,
        randomUUID(),
        'b'.repeat(64),
        aliceId,
        scheduledAt,
      ],
    );
    const candidates = [
      [
        firstCandidateId,
        firstPlaceId,
        'google-places:voting-one',
        'voting-one',
        'Voting one',
        1,
        900,
        1200,
      ],
      [
        secondCandidateId,
        secondPlaceId,
        'google-places:voting-two',
        'voting-two',
        'Voting two',
        2,
        1200,
        1500,
      ],
    ] as const;
    for (const [
      candidateId,
      placeId,
      key,
      providerPlaceId,
      name,
      rank,
      avgEta,
      maxEta,
    ] of candidates) {
      await db.query(
        `INSERT INTO recommendation_candidates (
           id, run_id, canonical_candidate_key, provider, provider_place_id, name,
           latitude, longitude, provider_types, source_categories, source_pages,
           filter_status, normalized_tags, created_at
         ) VALUES ($1, $2, $3, 'google-places', $4, $5, 10.7, 106.7,
           '[]'::jsonb, '[]'::jsonb, '[1]'::jsonb, 'ELIGIBLE', '[]'::jsonb, NOW())`,
        [candidateId, scenarioRunId, key, providerPlaceId, name],
      );
      await db.query(
        `INSERT INTO recommendation_places (
           id, run_id, candidate_id, canonical_candidate_key, rank, group_utility,
           candidate_least_misery_utility, pareto_level, inclusion_probability,
           avg_eta_seconds, max_eta_seconds, eta_range_seconds, scheduled_opening_status,
           opening_evidence, weather_evidence, closing_evidence, explanation, created_at
         ) VALUES ($1, $2, $3, $4, $5, 0.7, 0.6, 1, NULL, $6, $7, $8, 'OPEN',
           NULL, NULL, NULL, '{"summaryCode":"VOTING","facts":[],"warnings":[]}'::jsonb, NOW())`,
        [
          placeId,
          scenarioRunId,
          candidateId,
          key,
          rank,
          avgEta,
          maxEta,
          maxEta - avgEta,
        ],
      );
      for (const [participantId, eta, utility] of [
        [aliceParticipantId, avgEta, 0.7],
        [bobParticipantId, maxEta, 0.6],
      ] as const) {
        await db.query(
          `INSERT INTO recommendation_member_features (
             id, run_id, candidate_id, participant_id, canonical_candidate_key,
             eta_seconds, distance_meters, static_duration_seconds, matched_tags,
             missing_flags, travel_utility, preference_utility, place_quality_utility,
             member_utility, ranking_utility, route_status, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, 1000, 900, '[]'::jsonb,
             '[]'::jsonb, $7, 0.6, 0.8, $7, $7, 'OK', NOW())`,
          [
            randomUUID(),
            scenarioRunId,
            candidateId,
            participantId,
            key,
            eta,
            utility,
          ],
        );
      }
    }
    return {
      meetupId: scenarioMeetupId,
      runId: scenarioRunId,
      firstPlaceId,
      secondPlaceId,
      aliceParticipantId,
      bobParticipantId,
    };
  }

  it('serializes concurrent vote changes, finalizes the displayed run, and preserves the viewer-aware snapshot', async () => {
    const scenario = await createVotingScenario();
    const meetupStore = new TypeOrmMeetupRepository(db);
    const votingReader = new TypeOrmRecommendationVotingReader(
      db.getRepository(RecommendationRunEntity),
      db.getRepository(RecommendationPlaceEntity),
    );
    const voting = new TypeOrmMeetupVotingUnitOfWork(db);
    const cast = new CastMeetupVoteUseCase(voting, votingReader);
    const finalize = new FinalizeMeetupUseCase(
      voting,
      votingReader,
      new VoteWinnerDomainService(),
    );

    await Promise.all([
      cast.execute(
        aliceId,
        scenario.meetupId,
        scenario.runId,
        scenario.firstPlaceId,
      ),
      cast.execute(
        aliceId,
        scenario.meetupId,
        scenario.runId,
        scenario.secondPlaceId,
      ),
    ]);
    const votesAfterRace = await db.query<
      Array<{ recommendation_place_id: string }>
    >(
      `SELECT recommendation_place_id FROM votes
       WHERE meetup_id = $1 AND meetup_participant_id = $2`,
      [scenario.meetupId, scenario.aliceParticipantId],
    );
    expect(votesAfterRace).toHaveLength(1);
    expect([scenario.firstPlaceId, scenario.secondPlaceId]).toContain(
      votesAfterRace[0]?.recommendation_place_id,
    );

    await cast.execute(
      bobId,
      scenario.meetupId,
      scenario.runId,
      scenario.firstPlaceId,
    );
    const finalized = await finalize.execute(
      aliceId,
      scenario.meetupId,
      scenario.runId,
    );
    expect(finalized).toMatchObject({
      meetupId: scenario.meetupId,
      runId: scenario.runId,
    });
    await expect(
      db.query(
        `SELECT status, chosen_run_id, chosen_recommendation_place_id
         FROM meetup_sessions WHERE id = $1`,
        [scenario.meetupId],
      ),
    ).resolves.toEqual([
      {
        status: 'selected',
        chosen_run_id: scenario.runId,
        chosen_recommendation_place_id: finalized.recommendationPlaceId,
      },
    ]);
    const events = await db.query<
      Array<{ event_name: string; payload: Record<string, unknown> }>
    >(
      `SELECT event_name, payload FROM outbox_events
       WHERE payload->>'meetupId' = $1 AND event_name IN ('VoteUpdated.v1', 'MeetupFinalized.v1')`,
      [scenario.meetupId],
    );
    expect(events.some((event) => event.event_name === 'VoteUpdated.v1')).toBe(
      true,
    );
    expect(
      events.find((event) => event.event_name === 'MeetupFinalized.v1')
        ?.payload,
    ).toMatchObject({
      runId: scenario.runId,
      placeId: finalized.recommendationPlaceId,
      canonicalCandidateKey: finalized.canonicalCandidateKey,
    });
    await expect(
      db.query<Array<{ event_type: string }>>(
        `SELECT event_type FROM recommendation_feedback_events
          WHERE run_id = $1 ORDER BY created_at ASC`,
        [scenario.runId],
      ),
    ).resolves.toEqual(
      expect.arrayContaining([
        { event_type: 'PLACE_VOTED' },
        { event_type: 'VOTE_CHANGED' },
        { event_type: 'MEETUP_PLACE_SELECTED' },
      ]),
    );

    const repository = new TypeOrmRecommendationRunRepository(db);
    const getRun = new GetRecommendationRunUseCase(
      repository,
      new RecommendationRunFreshnessGuard(
        repository,
        new MeetupScheduleReader(meetupStore),
      ),
      new MeetupMembershipReader(meetupStore),
    );
    const [runCountBefore] = await db.query<Array<{ count: string }>>(
      `SELECT count(*)::text AS count FROM recommendation_runs WHERE id = $1`,
      [scenario.runId],
    );
    const [featureCountBefore] = await db.query<Array<{ count: string }>>(
      `SELECT count(*)::text AS count FROM recommendation_member_features WHERE run_id = $1`,
      [scenario.runId],
    );
    const aliceView = await getRun.execute(
      aliceId,
      scenario.meetupId,
      scenario.runId,
    );
    const bobView = await getRun.execute(
      bobId,
      scenario.meetupId,
      scenario.runId,
    );
    expect(aliceView.results.map((item) => item.memberEtas)).toEqual(
      bobView.results.map((item) => item.memberEtas),
    );
    expect(aliceView.results[0]?.viewerFeature?.participantId).toBe(
      scenario.aliceParticipantId,
    );
    expect(bobView.results[0]?.viewerFeature?.participantId).toBe(
      scenario.bobParticipantId,
    );
    await expect(
      db.query<Array<{ count: string }>>(
        `SELECT count(*)::text AS count FROM recommendation_runs WHERE id = $1`,
        [scenario.runId],
      ),
    ).resolves.toEqual([runCountBefore]);
    await expect(
      db.query<Array<{ count: string }>>(
        `SELECT count(*)::text AS count FROM recommendation_member_features WHERE run_id = $1`,
        [scenario.runId],
      ),
    ).resolves.toEqual([featureCountBefore]);
  });

  it('rejects outsider, unknown candidate, stale context, deadline and unauthorized finalize through real vote dependencies', async () => {
    const scenario = await createVotingScenario();
    const votingReader = new TypeOrmRecommendationVotingReader(
      db.getRepository(RecommendationRunEntity),
      db.getRepository(RecommendationPlaceEntity),
    );
    const voting = new TypeOrmMeetupVotingUnitOfWork(db);
    const cast = new CastMeetupVoteUseCase(voting, votingReader);
    const finalize = new FinalizeMeetupUseCase(
      voting,
      votingReader,
      new VoteWinnerDomainService(),
    );
    await expect(
      cast.execute(
        outsiderId,
        scenario.meetupId,
        scenario.runId,
        scenario.firstPlaceId,
      ),
    ).rejects.toMatchObject({ code: 'MEETUP_NOT_FOUND' });
    await expect(
      cast.execute(aliceId, scenario.meetupId, scenario.runId, randomUUID()),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(
      finalize.execute(
        outsiderId,
        scenario.meetupId,
        scenario.runId,
        scenario.firstPlaceId,
      ),
    ).rejects.toMatchObject({ code: 'MEETUP_NOT_FOUND' });
    await db.query(
      `UPDATE recommendation_runs
       SET provider_request_options_version = 'legacy-pre-temporal-v1'
       WHERE id = $1`,
      [scenario.runId],
    );
    await expect(
      cast.execute(
        aliceId,
        scenario.meetupId,
        scenario.runId,
        scenario.firstPlaceId,
      ),
    ).rejects.toMatchObject({ code: 'RECOMMENDATION_STALE_CONTEXT' });
    await db.query(
      `UPDATE recommendation_runs SET provider_request_options_version = 'request-v1' WHERE id = $1`,
      [scenario.runId],
    );
    await db.query(
      `UPDATE meetup_sessions SET vote_deadline_at = NOW() - INTERVAL '1 minute' WHERE id = $1`,
      [scenario.meetupId],
    );
    await expect(
      cast.execute(
        aliceId,
        scenario.meetupId,
        scenario.runId,
        scenario.firstPlaceId,
      ),
    ).rejects.toMatchObject({ code: 'MEETUP_VOTING_CLOSED' });
  });

  it('returns only finished accepted-member history with a selected-place snapshot and no route or coordinate data', async () => {
    const scenario = await createVotingScenario();
    await db.query(
      `UPDATE meetup_sessions
       SET status = 'finished', finished_at = NOW(), chosen_run_id = $2,
           chosen_recommendation_place_id = $3, chosen_by_id = $4, chosen_at = NOW(),
           vote_deadline_at = NULL, invitation_deadline_at = NOW() - INTERVAL '2 minutes',
           scheduled_at = NOW() - INTERVAL '1 minute'
       WHERE id = $1`,
      [scenario.meetupId, scenario.runId, scenario.firstPlaceId, aliceId],
    );
    const query = new ListMeetupHistoryQuery(
      new TypeOrmMeetupRepository(db),
      new TypeOrmRecommendationHistoryReader(
        db.getRepository(RecommendationPlaceEntity),
      ),
    );
    const page = await query.execute(aliceId, 0, 1);
    expect(page).toMatchObject({ total: 1, offset: 0, limit: 1 });
    expect(page.items[0]).toMatchObject({
      meetupId: scenario.meetupId,
      selectedPlace: { recommendationPlaceId: scenario.firstPlaceId },
    });
    expect(JSON.stringify(page.items[0])).not.toMatch(
      /latitude|longitude|route|etaSeconds/i,
    );
    await expect(query.execute(outsiderId, 0, 20)).resolves.toEqual({
      items: [],
      total: 0,
      offset: 0,
      limit: 20,
    });
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
