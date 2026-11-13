import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { Module, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PLACE_SEARCH } from '../src/bounded-contexts/recommendations/application/ports/place-search.port';
import { ROUTE_MATRIX } from '../src/bounded-contexts/recommendations/application/ports/route-matrix.port';
import { GooglePlacesAdapter } from '../src/bounded-contexts/recommendations/infrastructure/adapters/google-places.adapter';
import { GoogleRoutesAdapter } from '../src/bounded-contexts/recommendations/infrastructure/adapters/google-routes.adapter';
import { RecommendationsModule } from '../src/bounded-contexts/recommendations/recommendations.module';
import { configureApp } from '../src/configure-app';
import { configuration } from '../src/infrastructure/config/configuration';
import { validateEnvironment } from '../src/infrastructure/config/environment.validation';
import { DatabaseModule } from '../src/infrastructure/database/typeorm/database.module';
import { RedisModule } from '../src/infrastructure/redis/redis.module';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { RecommendationRunFreshnessGuard } from '../src/bounded-contexts/recommendations/application/public/recommendation-run-freshness.guard';

jest.setTimeout(30_000);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    RedisModule,
    RecommendationsModule,
  ],
})
class RecommendationE2eModule {}

interface RecommendationRunHttpBody {
  id: string;
  meetupId: string;
  requestId: string;
  status: string;
  effectiveK: number;
  warnings: string[];
  routeBatchCount: number;
  routeElementCount: number;
  contextStatus: 'CURRENT_CONTEXT' | 'STALE_CONTEXT';
  requestedAt: string;
  scheduledAtSnapshot: string;
  openingFilter: string;
  algorithmVersion: string;
  configVersion: string;
  featureSchemaVersion: string;
  results: Array<{
    rank: number;
    avgEtaSeconds: number;
    maxEtaSeconds: number;
    scheduledOpeningStatus: 'OPEN' | 'UNKNOWN' | null;
    candidate: { providerPlaceId: string; canonicalCandidateKey: string };
    memberEtas: Array<{
      participantId: string;
      etaSeconds: number;
    }>;
    viewerFeature: {
      participantId: string;
      matchedTags: Array<{ tagCode: string }>;
      travelUtility: number;
      preferenceUtility: number;
      placeQualityUtility: number;
      memberUtility: number;
    } | null;
    explanation: {
      summaryCode: string;
      facts: Array<{ key: string; value: string | number; source: string }>;
    };
  }>;
}

describe('Recommendation run HTTP + PostgreSQL + Redis + Google HTTP boundary', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let redis: RedisService;
  let google: Server;
  let googleEndpoint: string;
  let googleMode:
    | 'success'
    | 'empty'
    | 'failure'
    | 'routeFailure'
    | 'noRoute'
    | 'scheduledOpen'
    | 'scheduledClosed'
    | 'scheduledUnknown'
    | 'multiple' = 'success';
  let routeRequestCount = 0;
  const placeRequestBodies: Array<Record<string, unknown>> = [];
  const placeFieldMasks: string[] = [];
  const actorId = randomUUID();
  const memberId = randomUUID();
  const outsiderId = randomUUID();
  const meetupId = randomUUID();
  const actorSessionId = randomUUID();
  const memberSessionId = randomUUID();
  const outsiderSessionId = randomUUID();
  const actorParticipantId = randomUUID();
  const memberParticipantId = randomUUID();
  const accessSecret = process.env.JWT_ACCESS_SECRET!;

  beforeAll(async () => {
    google = createServer((incoming, response) => {
      let body = '';
      incoming.on('data', (chunk: Buffer) => {
        body += chunk.toString('utf8');
      });
      incoming.on('end', () => {
        const isRoute = incoming.url?.includes('computeRouteMatrix') ?? false;
        if (
          googleMode === 'failure' ||
          (googleMode === 'routeFailure' && isRoute)
        ) {
          response.writeHead(503, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: 'unavailable' }));
          return;
        }
        const parsed = JSON.parse(body) as { pageToken?: string };
        response.writeHead(200, { 'Content-Type': 'application/json' });
        if (isRoute) {
          routeRequestCount += 1;
          const routeInput = JSON.parse(body) as {
            origins: unknown[];
            destinations: unknown[];
          };
          response.end(
            JSON.stringify(
              routeInput.origins.flatMap((_, originIndex) =>
                routeInput.destinations.map((__, destinationIndex) => ({
                  originIndex,
                  destinationIndex,
                  condition:
                    googleMode === 'noRoute'
                      ? 'ROUTE_NOT_FOUND'
                      : 'ROUTE_EXISTS',
                  ...(googleMode === 'noRoute'
                    ? { status: { code: 5 } }
                    : {
                        distanceMeters: 1000 + originIndex,
                        duration: `${
                          googleMode.startsWith('scheduled')
                            ? 1500
                            : 300 + originIndex
                        }s`,
                      }),
                })),
              ),
            ),
          );
          return;
        }
        placeRequestBodies.push(parsed);
        placeFieldMasks.push(
          typeof incoming.headers['x-goog-fieldmask'] === 'string'
            ? incoming.headers['x-goog-fieldmask']
            : '',
        );
        response.end(
          JSON.stringify({
            places:
              googleMode === 'empty'
                ? []
                : (googleMode === 'multiple'
                    ? ['cafe-3', 'cafe-1', 'cafe-2']
                    : ['cafe-1']
                  ).map((id) => ({
                    id,
                    displayName: { text: `Cafe ${id}` },
                    types: ['cafe'],
                    location: {
                      latitude: 10.7 + Number(id.at(-1)) * 0.0001,
                      longitude: 106.7,
                    },
                    businessStatus: 'OPERATIONAL',
                    ...(googleMode === 'scheduledUnknown'
                      ? {}
                      : googleMode === 'scheduledClosed'
                        ? {
                            utcOffsetMinutes: 0,
                            regularOpeningHours: {
                              periods: [
                                {
                                  open: { day: 0, hour: 1, minute: 0 },
                                  close: { day: 0, hour: 2, minute: 0 },
                                },
                              ],
                            },
                          }
                        : googleMode === 'scheduledOpen'
                          ? {
                              utcOffsetMinutes: 0,
                              regularOpeningHours: {
                                periods: [
                                  {
                                    open: { day: 0, hour: 0, minute: 0 },
                                  },
                                ],
                              },
                            }
                          : { currentOpeningHours: { openNow: true } }),
                  })),
            ...(parsed.pageToken ? {} : {}),
          }),
        );
      });
    });
    await new Promise<void>((resolve) =>
      google.listen(0, '127.0.0.1', resolve),
    );
    const address = google.address();
    if (!address || typeof address === 'string')
      throw new Error('HTTP boundary');
    googleEndpoint = `http://127.0.0.1:${address.port}/v1/places:searchText`;

    const fixture = await Test.createTestingModule({
      imports: [RecommendationE2eModule],
    })
      .overrideProvider(PLACE_SEARCH)
      .useFactory({
        factory: () =>
          new GooglePlacesAdapter('test-key', fetch, 2, 1_000, googleEndpoint),
      })
      .overrideProvider(ROUTE_MATRIX)
      .useFactory({
        factory: () =>
          new GoogleRoutesAdapter(
            'test-key',
            fetch,
            2,
            1_000,
            googleEndpoint.replace(
              '/v1/places:searchText',
              '/distanceMatrix/v2:computeRouteMatrix',
            ),
          ),
      })
      .compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DataSource);
    redis = app.get(RedisService);
    await seed();
  });

  afterAll(async () => {
    await redis?.del(`meetup-location:${meetupId}:${actorId}`);
    await redis?.del(`meetup-location:${meetupId}:${memberId}`);
    await db?.query('DELETE FROM recommendation_runs WHERE meetup_id = $1', [
      meetupId,
    ]);
    await db?.query(
      `DELETE FROM chat_conversation_members
       WHERE conversation_id IN (
         SELECT id FROM chat_conversations WHERE meetup_id = $1
       )`,
      [meetupId],
    );
    await db?.query('DELETE FROM chat_conversations WHERE meetup_id = $1', [
      meetupId,
    ]);
    await db?.query('DELETE FROM meetup_sessions WHERE id = $1', [meetupId]);
    await db?.query(
      'DELETE FROM user_sessions WHERE user_account_id IN ($1, $2, $3)',
      [actorId, memberId, outsiderId],
    );
    await db?.query('DELETE FROM user_accounts WHERE id IN ($1, $2, $3)', [
      actorId,
      memberId,
      outsiderId,
    ]);
    await app?.close();
    if (google) {
      await new Promise<void>((resolve, reject) =>
        google.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  async function seed() {
    await db.query(
      `INSERT INTO user_accounts (id, email, display_name, created_at, updated_at) VALUES ($1, $2, 'Actor', NOW(), NOW()), ($3, $4, 'Member', NOW(), NOW()), ($5, $6, 'Outsider', NOW(), NOW())`,
      [
        actorId,
        `${actorId}@test.invalid`,
        memberId,
        `${memberId}@test.invalid`,
        outsiderId,
        `${outsiderId}@test.invalid`,
      ],
    );
    await db.query(
      `INSERT INTO user_sessions (id, user_account_id, refresh_token_hash, refresh_token_family_id, expires_at, created_at) VALUES ($1, $2, $3, $4, NOW() + interval '1 day', NOW())`,
      [actorSessionId, actorId, randomUUID(), randomUUID()],
    );
    await db.query(
      `INSERT INTO user_sessions (id, user_account_id, refresh_token_hash, refresh_token_family_id, expires_at, created_at) VALUES ($1, $2, $3, $4, NOW() + interval '1 day', NOW())`,
      [memberSessionId, memberId, randomUUID(), randomUUID()],
    );
    await db.query(
      `INSERT INTO user_sessions (id, user_account_id, refresh_token_hash, refresh_token_family_id, expires_at, created_at) VALUES ($1, $2, $3, $4, NOW() + interval '1 day', NOW())`,
      [outsiderSessionId, outsiderId, randomUUID(), randomUUID()],
    );
    await db.query(
      `INSERT INTO privacy_settings (id, user_id, sharing_mode, is_location_sharing_enabled, use_approximate_location, nearby_feature_enabled, selected_friend_ids, updated_at) VALUES ($1, $2, 'meetup_only', true, false, false, '{}', NOW() - interval '1 minute'), ($3, $4, 'meetup_only', true, true, false, '{}', NOW() - interval '1 minute')`,
      [randomUUID(), actorId, randomUUID(), memberId],
    );
    await db.query(
      `INSERT INTO meetup_sessions (id, organizer_id, title, scheduled_at, invitation_deadline_at, search_radius_m, place_type, recommendation_mode, status, created_at, updated_at) VALUES ($1, $2, 'E2E', $3, $4, 1000, 'cafe', 'balanced', 'inviting', NOW(), NOW())`,
      [
        meetupId,
        actorId,
        '2030-01-01T19:00:00.000Z',
        '2030-01-01T18:00:00.000Z',
      ],
    );
    await db.query(
      `INSERT INTO meetup_participants (id, meetup_id, user_id, status, invited_by_id, responded_at, joined_at) VALUES ($1, $2, $3, 'accepted', $3, NOW(), NOW()), ($4, $2, $5, 'accepted', $3, NOW(), NOW())`,
      [actorParticipantId, meetupId, actorId, memberParticipantId, memberId],
    );
    const recordedAt = new Date().toISOString();
    await redis.set(
      `meetup-location:${meetupId}:${actorId}`,
      JSON.stringify({
        latitude: 10.7,
        longitude: 106.7,
        accuracy: 10,
        recordedAt,
      }),
      300,
    );
    await redis.set(
      `meetup-location:${meetupId}:${memberId}`,
      JSON.stringify({
        latitude: 10.704,
        longitude: 106.704,
        accuracy: 15,
        recordedAt,
      }),
      300,
    );
  }

  async function token(userId = actorId, sessionId = actorSessionId) {
    return new JwtService().signAsync(
      { sub: userId, sid: sessionId, type: 'access' },
      {
        secret: accessSecret,
        algorithm: 'HS256',
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
        expiresIn: 900,
      },
    );
  }

  const body = () => ({
    topK: 2,
    filters: {
      categories: ['cafe'],
      openingFilter: 'OPEN_AT_REQUEST_TIME',
      radiusMeters: 1000,
    },
  });

  const scheduledBody = () => ({
    topK: 2,
    filters: {
      categories: ['cafe'],
      openingFilter: 'OPEN_AT_SCHEDULED_TIME',
      radiusMeters: 1000,
    },
  });

  it('POST persists a completed run, retry is idempotent, and GET returns it', async () => {
    googleMode = 'success';
    const authorization = `Bearer ${await token()}`;
    const requestId = randomUUID();
    const created = await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
      .set('Authorization', authorization)
      .set('Idempotency-Key', requestId)
      .send(body())
      .expect(200);
    const createdBody = created.body as RecommendationRunHttpBody;
    expect(createdBody).toMatchObject({
      meetupId,
      requestId,
      status: 'COMPLETED',
      effectiveK: 1,
      warnings: ['RESULT_COUNT_BELOW_REQUESTED_K'],
      routeBatchCount: 1,
      routeElementCount: 2,
      contextStatus: 'CURRENT_CONTEXT',
    });
    expect(createdBody.results).toHaveLength(1);
    expect(createdBody.results[0]).toMatchObject({ rank: 1 });
    expect(Number.isFinite(createdBody.results[0].avgEtaSeconds)).toBe(true);
    expect(createdBody.results[0]).not.toHaveProperty('groupUtility');
    expect(createdBody.results[0]).not.toHaveProperty(
      'candidateLeastMiseryUtility',
    );
    expect(
      await db.query(
        'SELECT count(*)::int AS count FROM recommendation_member_features WHERE run_id = $1',
        [createdBody.id],
      ),
    ).toEqual([{ count: 2 }]);

    const retried = await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
      .set('Authorization', authorization)
      .set('Idempotency-Key', requestId)
      .send(body())
      .expect(200);
    const retriedBody = retried.body as RecommendationRunHttpBody;
    expect(retriedBody.id).toBe(createdBody.id);
    expect(retriedBody.results).toEqual(createdBody.results);
    expect(retriedBody.algorithmVersion).toBe(createdBody.algorithmVersion);
    expect(retriedBody.configVersion).toBe(createdBody.configVersion);
    expect(retriedBody.featureSchemaVersion).toBe(
      createdBody.featureSchemaVersion,
    );
    expect(
      await db.query(
        'SELECT count(*)::int AS count FROM recommendation_runs WHERE meetup_id = $1 AND request_id = $2',
        [meetupId, requestId],
      ),
    ).toEqual([{ count: 1 }]);
    expect(
      await db.query(
        `SELECT
           (SELECT count(*)::int FROM recommendation_candidates WHERE run_id = $1) AS candidates,
           (SELECT count(*)::int FROM recommendation_member_features WHERE run_id = $1) AS features,
           (SELECT count(*)::int FROM recommendation_places WHERE run_id = $1) AS places,
           (SELECT count(*)::int FROM outbox_events WHERE event_name = 'RecommendationReady.v1' AND payload->>'runId' = $1::text) AS events`,
        [createdBody.id],
      ),
    ).toEqual([{ candidates: 1, features: 2, places: 1, events: 1 }]);

    const fetched = await request(app.getHttpServer())
      .get(`/api/v1/meetups/${meetupId}/recommendation-runs/${createdBody.id}`)
      .set('Authorization', authorization)
      .expect(200);
    expect(fetched.body).toEqual(retriedBody);

    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
      .set('Authorization', authorization)
      .set('Idempotency-Key', requestId)
      .send({ ...body(), topK: 3 })
      .expect(409)
      .expect(({ body: error }) => {
        expect(error).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
      });
  });

  it('returns shared ETAs but only the requesting accepted member feature', async () => {
    googleMode = 'success';
    const created = await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
      .set('Authorization', `Bearer ${await token()}`)
      .set('Idempotency-Key', randomUUID())
      .send(body())
      .expect(200);
    const run = created.body as RecommendationRunHttpBody;

    const organizer = await request(app.getHttpServer())
      .get(`/api/v1/meetups/${meetupId}/recommendation-runs/${run.id}`)
      .set('Authorization', `Bearer ${await token()}`)
      .expect(200);
    const member = await request(app.getHttpServer())
      .get(`/api/v1/meetups/${meetupId}/recommendation-runs/${run.id}`)
      .set('Authorization', `Bearer ${await token(memberId, memberSessionId)}`)
      .expect(200);

    const organizerResult = (organizer.body as RecommendationRunHttpBody)
      .results[0];
    const memberResult = (member.body as RecommendationRunHttpBody).results[0];
    expect(memberResult.memberEtas).toEqual(organizerResult.memberEtas);
    expect(organizerResult.viewerFeature.participantId).toBe(
      actorParticipantId,
    );
    expect(memberResult.viewerFeature.participantId).toBe(memberParticipantId);
    expect(organizerResult).not.toHaveProperty('groupUtility');
    expect(memberResult).not.toHaveProperty('groupUtility');
    expect(JSON.stringify(memberResult.viewerFeature)).not.toContain(
      actorParticipantId,
    );
    await request(app.getHttpServer())
      .get(`/api/v1/meetups/${meetupId}/recommendation-runs/${run.id}`)
      .set(
        'Authorization',
        `Bearer ${await token(outsiderId, outsiderSessionId)}`,
      )
      .expect(403)
      .expect(({ body: error }) =>
        expect(error).toMatchObject({ code: 'RECOMMENDATION_RUN_FORBIDDEN' }),
      );
  });

  it('evaluates scheduled opening before Routes and persists temporal evidence', async () => {
    await db.query(
      'UPDATE meetup_sessions SET scheduled_at = $2 WHERE id = $1',
      [meetupId, '2030-01-01T19:00:00.000Z'],
    );
    googleMode = 'scheduledOpen';
    placeRequestBodies.length = 0;
    placeFieldMasks.length = 0;
    const created = await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
      .set('Authorization', `Bearer ${await token()}`)
      .set('Idempotency-Key', randomUUID())
      .send(scheduledBody())
      .expect(200);
    const result = created.body as RecommendationRunHttpBody;

    expect(placeRequestBodies).not.toHaveLength(0);
    expect(placeRequestBodies.every((value) => !('openNow' in value))).toBe(
      true,
    );
    expect(placeFieldMasks[0]).toContain('places.currentOpeningHours');
    expect(placeFieldMasks[0]).toContain('places.regularOpeningHours');
    expect(placeFieldMasks[0]).toContain('places.utcOffsetMinutes');
    expect(result).toMatchObject({
      scheduledAtSnapshot: '2030-01-01T19:00:00.000Z',
      openingFilter: 'OPEN_AT_SCHEDULED_TIME',
      contextStatus: 'CURRENT_CONTEXT',
    });
    expect(result.warnings).toContain('OPENING_FROM_REGULAR_HOURS');
    expect(result.results[0]).toMatchObject({
      scheduledOpeningStatus: 'OPEN',
    });
    expect(result.results[0].memberEtas).toHaveLength(2);
    expect(
      result.results[0].memberEtas.every(
        (feature) => feature.etaSeconds === 1500,
      ),
    ).toBe(true);
    expect(result.results[0].memberEtas[0]).not.toHaveProperty(
      'recommendedDepartureAt',
    );
    const rows = await db.query<
      Array<{
        requested_at: Date;
        scheduled_at_snapshot: Date;
        opening_filter: string;
        scheduled_opening_status: string;
        opening_evidence: {
          evaluatorVersion: string;
          source: string;
        };
      }>
    >(
      `SELECT run.requested_at, run.scheduled_at_snapshot, run.opening_filter,
                candidate.scheduled_opening_status, candidate.opening_evidence
         FROM recommendation_runs run
         JOIN recommendation_candidates candidate ON candidate.run_id = run.id
         JOIN recommendation_member_features feature ON feature.run_id = run.id
         WHERE run.id = $1
         ORDER BY feature.participant_id`,
      [result.id],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].opening_filter).toBe('OPEN_AT_SCHEDULED_TIME');
    expect(rows[0].scheduled_opening_status).toBe('OPEN');
    expect(rows[0].opening_evidence).toEqual({
      evaluatorVersion: 'scheduled-opening-evaluator-v1',
      source: 'REGULAR',
      evaluatedLocalDateTime: '2030-01-01T19:00',
      utcOffsetMinutes: 0,
      matchedPeriod: { open: { day: 0, hour: 0, minute: 0 } },
      fallbackToRegularHours: true,
    });
  });

  it('takes scheduledAt only from the meetup', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
      .set('Authorization', `Bearer ${await token()}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        ...scheduledBody(),
        scheduledAt: '2040-01-01T12:00:00.000Z',
      })
      .expect(400)
      .expect(({ body: error }) =>
        expect(error).toMatchObject({ code: 'INVALID_INPUT' }),
      );

    await db.query(
      'UPDATE meetup_sessions SET scheduled_at = $2, invitation_deadline_at = $3 WHERE id = $1',
      [meetupId, '2030-01-02T00:10:00.000Z', '2029-12-31T00:00:00.000Z'],
    );
    googleMode = 'scheduledOpen';
    const created = await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
      .set('Authorization', `Bearer ${await token()}`)
      .set('Idempotency-Key', randomUUID())
      .send(scheduledBody())
      .expect(200);
    const result = created.body as RecommendationRunHttpBody;

    expect(result.scheduledAtSnapshot).toBe('2030-01-02T00:10:00.000Z');
    expect(result.results[0].memberEtas.map((item) => item.etaSeconds)).toEqual(
      [1500, 1500],
    );
  });

  it('filters CLOSED before Routes and keeps UNKNOWN with a warning', async () => {
    await db.query(
      'UPDATE meetup_sessions SET scheduled_at = $2 WHERE id = $1',
      [meetupId, '2030-01-01T19:00:00.000Z'],
    );
    googleMode = 'scheduledClosed';
    const routesBeforeClosed = routeRequestCount;
    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
      .set('Authorization', `Bearer ${await token()}`)
      .set('Idempotency-Key', randomUUID())
      .send(scheduledBody())
      .expect(422)
      .expect(({ body: error }) =>
        expect(error).toMatchObject({ code: 'NO_ELIGIBLE_CANDIDATES' }),
      );
    expect(routeRequestCount).toBe(routesBeforeClosed);

    googleMode = 'scheduledUnknown';
    const unknown = await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
      .set('Authorization', `Bearer ${await token()}`)
      .set('Idempotency-Key', randomUUID())
      .send(scheduledBody())
      .expect(200);
    const unknownBody = unknown.body as RecommendationRunHttpBody;
    expect(unknownBody.warnings).toEqual(
      expect.arrayContaining(['OPENING_STATUS_UNKNOWN']),
    );
    expect(unknownBody.results[0].scheduledOpeningStatus).toBe('UNKNOWN');
  });

  it('returns STALE_CONTEXT without mutating the snapshot and blocks decision guard', async () => {
    await db.query(
      'UPDATE meetup_sessions SET scheduled_at = $2 WHERE id = $1',
      [meetupId, '2030-01-01T19:00:00.000Z'],
    );
    googleMode = 'scheduledOpen';
    const created = await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
      .set('Authorization', `Bearer ${await token()}`)
      .set('Idempotency-Key', randomUUID())
      .send(scheduledBody())
      .expect(200);
    const original = created.body as RecommendationRunHttpBody;
    const originalRanks = original.results.map((item) => item.rank);

    await db.query(
      'UPDATE meetup_sessions SET scheduled_at = $2 WHERE id = $1',
      [meetupId, '2030-01-01T20:00:00.000Z'],
    );
    const stale = await request(app.getHttpServer())
      .get(`/api/v1/meetups/${meetupId}/recommendation-runs/${original.id}`)
      .set('Authorization', `Bearer ${await token()}`)
      .expect(200);
    expect(stale.body).toMatchObject({
      id: original.id,
      contextStatus: 'STALE_CONTEXT',
      scheduledAtSnapshot: '2030-01-01T19:00:00.000Z',
    });
    expect(
      (stale.body as RecommendationRunHttpBody).results.map(
        (item) => item.rank,
      ),
    ).toEqual(originalRanks);
    await expect(
      app
        .get(RecommendationRunFreshnessGuard)
        .assertFreshForDecision(meetupId, original.id),
    ).rejects.toMatchObject({ code: 'RECOMMENDATION_STALE_CONTEXT' });
    expect(
      await db.query(
        'SELECT scheduled_at_snapshot, status FROM recommendation_runs WHERE id = $1',
        [original.id],
      ),
    ).toEqual([
      {
        scheduled_at_snapshot: new Date('2030-01-01T19:00:00.000Z'),
        status: 'COMPLETED',
      },
    ]);
  });

  it.each([
    ['empty', 'NO_ELIGIBLE_CANDIDATES', 422],
    ['failure', 'PLACE_SEARCH_UNAVAILABLE', 503],
    ['routeFailure', 'ROUTE_MATRIX_UNAVAILABLE', 503],
    ['noRoute', 'NO_ROUTABLE_CANDIDATES', 422],
  ] as const)(
    'persists terminal %s provider outcomes',
    async (mode, code, status) => {
      googleMode = mode;
      const requestId = randomUUID();
      await request(app.getHttpServer())
        .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
        .set('Authorization', `Bearer ${await token()}`)
        .set('Idempotency-Key', requestId)
        .send(body())
        .expect(status)
        .expect(({ body: error }) => expect(error).toMatchObject({ code }));
      expect(
        await db.query(
          'SELECT status, failure_code FROM recommendation_runs WHERE meetup_id = $1 AND request_id = $2',
          [meetupId, requestId],
        ),
      ).toEqual([{ status: 'FAILED', failure_code: code }]);
      const callsAfterFailure = placeRequestBodies.length;
      await request(app.getHttpServer())
        .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
        .set('Authorization', `Bearer ${await token()}`)
        .set('Idempotency-Key', requestId)
        .send(body())
        .expect(status)
        .expect(({ body: error }) => expect(error).toMatchObject({ code }));
      expect(placeRequestBodies).toHaveLength(callsAfterFailure);
    },
  );

  it('stores the full rank while returning only top-K with exact explanation facts', async () => {
    googleMode = 'multiple';
    const created = await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
      .set('Authorization', `Bearer ${await token()}`)
      .set('Idempotency-Key', randomUUID())
      .send(body())
      .expect(200);
    const result = created.body as RecommendationRunHttpBody;
    expect(result.results).toHaveLength(2);
    expect(result.results.map((item) => item.rank)).toEqual([1, 2]);
    expect(result.results.every((item) => item.memberEtas.length === 2)).toBe(
      true,
    );
    for (const item of result.results) {
      expect(item.explanation.summaryCode).toBe('FAIR_PARETO_RANKED');
      expect(item.explanation.facts).toEqual(
        expect.arrayContaining([
          { key: 'rank', value: item.rank, unit: 'COUNT', source: 'ENGINE' },
          {
            key: 'avgEtaSeconds',
            value: item.avgEtaSeconds,
            unit: 'SECOND',
            source: 'ROUTES',
          },
          {
            key: 'maxEtaSeconds',
            value: item.maxEtaSeconds,
            unit: 'SECOND',
            source: 'ROUTES',
          },
        ]),
      );
    }
    expect(
      await db.query(
        'SELECT count(*)::int AS count FROM recommendation_places WHERE run_id = $1',
        [result.id],
      ),
    ).toEqual([{ count: 3 }]);
  });

  it('returns 409 for a retry while the stored run is RUNNING', async () => {
    googleMode = 'success';
    const authorization = `Bearer ${await token()}`;
    const requestId = randomUUID();
    const created = await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
      .set('Authorization', authorization)
      .set('Idempotency-Key', requestId)
      .send(body())
      .expect(200);
    const createdBody = created.body as RecommendationRunHttpBody;
    await db.query(
      "UPDATE recommendation_runs SET status = 'RUNNING' WHERE id = $1",
      [createdBody.id],
    );
    try {
      await request(app.getHttpServer())
        .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
        .set('Authorization', authorization)
        .set('Idempotency-Key', requestId)
        .send(body())
        .expect(409)
        .expect(({ body: error }) =>
          expect(error).toMatchObject({
            code: 'RECOMMENDATION_RUN_IN_PROGRESS',
          }),
        );
    } finally {
      await db.query(
        "UPDATE recommendation_runs SET status = 'COMPLETED' WHERE id = $1",
        [createdBody.id],
      );
    }
  });

  it('rolls back snapshots and returns no success when completion transition fails', async () => {
    const functionName = `reject_completion_${randomUUID().replaceAll('-', '')}`;
    await db.query(`
      CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
      BEGIN
        IF NEW.status = 'COMPLETED' THEN
          RAISE EXCEPTION 'injected completion transition failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER ${functionName}
      BEFORE UPDATE ON recommendation_runs
      FOR EACH ROW EXECUTE FUNCTION ${functionName}();
    `);
    const requestId = randomUUID();
    try {
      googleMode = 'success';
      await request(app.getHttpServer())
        .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
        .set('Authorization', `Bearer ${await token()}`)
        .set('Idempotency-Key', requestId)
        .send(body())
        .expect(503);
    } finally {
      await db.query(`DROP TRIGGER ${functionName} ON recommendation_runs`);
      await db.query(`DROP FUNCTION ${functionName}()`);
    }
    const rows = await db.query<Array<{ id: string; status: string }>>(
      'SELECT id, status FROM recommendation_runs WHERE request_id = $1',
      [requestId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('FAILED');
    expect(
      await db.query(
        `SELECT
           (SELECT count(*)::int FROM recommendation_candidates WHERE run_id = $1) AS candidates,
           (SELECT count(*)::int FROM recommendation_member_features WHERE run_id = $1) AS features,
           (SELECT count(*)::int FROM recommendation_places WHERE run_id = $1) AS places,
           (SELECT count(*)::int FROM outbox_events WHERE payload->>'runId' = $1::text) AS events`,
        [rows[0].id],
      ),
    ).toEqual([{ candidates: 0, features: 0, places: 0, events: 0 }]);
  });

  it('returns the documented validation error without creating a run', async () => {
    const requestId = randomUUID();
    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
      .set('Authorization', `Bearer ${await token()}`)
      .set('Idempotency-Key', requestId)
      .send({ ...body(), filters: { ...body().filters, radiusMeters: 10_001 } })
      .expect(400)
      .expect(({ body: error }) =>
        expect(error).toMatchObject({ code: 'INVALID_INPUT' }),
      );
    expect(
      await db.query(
        'SELECT count(*)::int AS count FROM recommendation_runs WHERE request_id = $1',
        [requestId],
      ),
    ).toEqual([{ count: 0 }]);
  });
});
