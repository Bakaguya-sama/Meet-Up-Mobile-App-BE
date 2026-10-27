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
import { GooglePlacesAdapter } from '../src/bounded-contexts/recommendations/infrastructure/adapters/google-places.adapter';
import { RecommendationsModule } from '../src/bounded-contexts/recommendations/recommendations.module';
import { configureApp } from '../src/configure-app';
import { configuration } from '../src/infrastructure/config/configuration';
import { validateEnvironment } from '../src/infrastructure/config/environment.validation';
import { DatabaseModule } from '../src/infrastructure/database/typeorm/database.module';
import { RedisModule } from '../src/infrastructure/redis/redis.module';
import { RedisService } from '../src/infrastructure/redis/redis.service';

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
  candidates: unknown[];
}

describe('Recommendation run HTTP + PostgreSQL + Redis + Google HTTP boundary', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let redis: RedisService;
  let google: Server;
  let googleEndpoint: string;
  let googleMode: 'success' | 'empty' | 'failure' = 'success';
  const actorId = randomUUID();
  const memberId = randomUUID();
  const meetupId = randomUUID();
  const actorSessionId = randomUUID();
  const accessSecret = process.env.JWT_ACCESS_SECRET!;

  beforeAll(async () => {
    google = createServer((incoming, response) => {
      let body = '';
      incoming.on('data', (chunk: Buffer) => {
        body += chunk.toString('utf8');
      });
      incoming.on('end', () => {
        if (googleMode === 'failure') {
          response.writeHead(503, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: 'unavailable' }));
          return;
        }
        const parsed = JSON.parse(body) as { pageToken?: string };
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify({
            places:
              googleMode === 'empty'
                ? []
                : [
                    {
                      id: 'cafe-1',
                      displayName: { text: 'Cafe One' },
                      types: ['cafe'],
                      location: { latitude: 10.7, longitude: 106.7 },
                      businessStatus: 'OPERATIONAL',
                      currentOpeningHours: { openNow: true },
                    },
                  ],
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
    await db?.query('DELETE FROM meetup_sessions WHERE id = $1', [meetupId]);
    await db?.query(
      'DELETE FROM user_sessions WHERE user_account_id IN ($1, $2)',
      [actorId, memberId],
    );
    await db?.query('DELETE FROM user_accounts WHERE id IN ($1, $2)', [
      actorId,
      memberId,
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
      `INSERT INTO user_accounts (id, email, display_name, created_at, updated_at) VALUES ($1, $2, 'Actor', NOW(), NOW()), ($3, $4, 'Member', NOW(), NOW())`,
      [
        actorId,
        `${actorId}@test.invalid`,
        memberId,
        `${memberId}@test.invalid`,
      ],
    );
    await db.query(
      `INSERT INTO user_sessions (id, user_account_id, refresh_token_hash, refresh_token_family_id, expires_at, created_at) VALUES ($1, $2, $3, $4, NOW() + interval '1 day', NOW())`,
      [actorSessionId, actorId, randomUUID(), randomUUID()],
    );
    await db.query(
      `INSERT INTO privacy_settings (id, user_id, sharing_mode, is_location_sharing_enabled, use_approximate_location, nearby_feature_enabled, selected_friend_ids, updated_at) VALUES ($1, $2, 'meetup_only', true, false, false, '{}', NOW() - interval '1 minute'), ($3, $4, 'meetup_only', true, true, false, '{}', NOW() - interval '1 minute')`,
      [randomUUID(), actorId, randomUUID(), memberId],
    );
    await db.query(
      `INSERT INTO meetup_sessions (id, organizer_id, title, scheduled_at, invitation_deadline_at, search_radius_m, place_type, recommendation_mode, status, created_at, updated_at) VALUES ($1, $2, 'E2E', NOW() + interval '2 hours', NOW() + interval '1 hour', 1000, 'cafe', 'balanced', 'inviting', NOW(), NOW())`,
      [meetupId, actorId],
    );
    await db.query(
      `INSERT INTO meetup_participants (id, meetup_id, user_id, status, invited_by_id, responded_at, joined_at) VALUES ($1, $2, $3, 'accepted', $3, NOW(), NOW()), ($4, $2, $5, 'accepted', $3, NOW(), NOW())`,
      [randomUUID(), meetupId, actorId, randomUUID(), memberId],
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
        latitude: 10.71,
        longitude: 106.71,
        accuracy: 15,
        recordedAt,
      }),
      300,
    );
  }

  async function token() {
    return new JwtService().signAsync(
      { sub: actorId, sid: actorSessionId, type: 'access' },
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
    });
    expect(createdBody.candidates).toHaveLength(1);

    const retried = await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/recommendation-runs`)
      .set('Authorization', authorization)
      .set('Idempotency-Key', requestId)
      .send(body())
      .expect(200);
    const retriedBody = retried.body as RecommendationRunHttpBody;
    expect(retriedBody.id).toBe(createdBody.id);
    expect(
      await db.query(
        'SELECT count(*)::int AS count FROM recommendation_runs WHERE meetup_id = $1 AND request_id = $2',
        [meetupId, requestId],
      ),
    ).toEqual([{ count: 1 }]);

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

  it.each([
    ['empty', 'NO_ELIGIBLE_CANDIDATES', 422],
    ['failure', 'PLACE_SEARCH_UNAVAILABLE', 503],
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
    },
  );

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
