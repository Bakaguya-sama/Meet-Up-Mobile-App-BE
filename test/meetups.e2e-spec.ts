import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  type ExecutionContext,
  type INestApplication,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '../src/configure-app';
import { AccessTokenGuard } from '../src/presentation/http/guards/access-token.guard';
import { MeetupsController } from '../src/bounded-contexts/meetups/presentation/http/meetups.controller';
import { CreateMeetupUseCase } from '../src/bounded-contexts/meetups/application/use-cases/create-meetup.use-case';
import { InviteParticipantsUseCase } from '../src/bounded-contexts/meetups/application/use-cases/invite-participants.use-case';
import { UpdateMeetupUseCase } from '../src/bounded-contexts/meetups/application/use-cases/update-meetup.use-case';
import { RespondInvitationUseCase } from '../src/bounded-contexts/meetups/application/use-cases/respond-invitation.use-case';
import { LeaveMeetupUseCase } from '../src/bounded-contexts/meetups/application/use-cases/leave-meetup.use-case';
import { RemoveParticipantUseCase } from '../src/bounded-contexts/meetups/application/use-cases/remove-participant.use-case';
import { CancelMeetupUseCase } from '../src/bounded-contexts/meetups/application/use-cases/cancel-meetup.use-case';
import { FinishMeetupUseCase } from '../src/bounded-contexts/meetups/application/use-cases/finish-meetup.use-case';
import { GetMeetupDetailQuery } from '../src/bounded-contexts/meetups/application/queries/get-meetup-detail.query';
import { ListMeetupsQuery } from '../src/bounded-contexts/meetups/application/queries/list-meetups.query';
import { MeetupMembershipReader } from '../src/bounded-contexts/meetups/application/public/meetup-membership-reader';
import { MeetupLocationAdapter } from '../src/bounded-contexts/locations/infrastructure/adapters/meetup-location.adapter';
import { isIntegrationEvent } from '../src/shared-kernel/application/integration-event.contract';
import { InMemoryMeetupStore } from './support/in-memory-meetup-store';

describe('Meetup HTTP contract', () => {
  const alice = 'aaaaaaaa-0000-4000-8000-000000000001';
  const bob = 'bbbbbbbb-0000-4000-8000-000000000002';
  const carol = 'cccccccc-0000-4000-8000-000000000003';
  const locked = 'dddddddd-0000-4000-8000-000000000004';
  let app: INestApplication<App>;
  const store = new InMemoryMeetupStore();
  const eligibility = {
    eligibleIds: jest.fn((_: string, ids: string[]) =>
      Promise.resolve(ids.filter((id) => id === bob)),
    ),
  };
  const membership = new MeetupLocationAdapter(
    new MeetupMembershipReader(store),
  );
  const auth = (id: string) => ({ Authorization: `Bearer ${id}` });
  const body = () => ({
    title: 'Coffee',
    scheduledAt: new Date(Date.now() + 7200000).toISOString(),
    invitationDeadlineAt: new Date(Date.now() + 3600000).toISOString(),
    searchRadiusM: 5000,
    placeType: 'cafe',
    inviteeIds: [bob],
  });

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      controllers: [MeetupsController],
      providers: [
        {
          provide: ConfigService,
          useValue: new ConfigService({
            app: { apiPrefix: 'api/v1', swaggerEnabled: false },
          }),
        },
        ...[CreateMeetupUseCase, InviteParticipantsUseCase].map((useCase) => ({
          provide: useCase,
          useValue: new useCase(store, eligibility),
        })),
        ...[
          UpdateMeetupUseCase,
          RespondInvitationUseCase,
          LeaveMeetupUseCase,
          RemoveParticipantUseCase,
          CancelMeetupUseCase,
          FinishMeetupUseCase,
          GetMeetupDetailQuery,
          ListMeetupsQuery,
        ].map((useCase) => ({
          provide: useCase,
          useValue: new useCase(store),
        })),
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context
            .switchToHttp()
            .getRequest<Request & { user: { id: string; roles: string[] } }>();
          const id = req.headers.authorization?.replace('Bearer ', '');
          if (!id || ![alice, bob, carol, locked].includes(id))
            throw new UnauthorizedException();
          if (id === locked) throw new ForbiddenException();
          req.user = { id, roles: ['user'] };
          return true;
        },
      })
      .compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
  });
  beforeEach(() => {
    store.rows.clear();
    store.deliveries.length = 0;
    eligibility.eligibleIds.mockClear();
  });
  afterAll(async () => {
    await app?.close();
  });
  async function create() {
    const response = await request(app.getHttpServer())
      .post('/api/v1/meetups')
      .set(auth(alice))
      .send(body())
      .expect(201);
    return (response.body as { id: string }).id;
  }

  it('creates the default mode, membership and valid outbox deliveries', async () => {
    const id = await create();
    expect(store.rows.get(id)).toMatchObject({
      status: 'inviting',
      recommendationMode: 'balanced',
    });
    expect(store.deliveries).toHaveLength(2);
    expect(store.deliveries.every((row) => isIntegrationEvent(row.event))).toBe(
      true,
    );
    expect(new Set(store.deliveries.map((row) => row.event.eventId)).size).toBe(
      2,
    );
    expect(await membership.canJoin(bob, id)).toBe(false);
    expect(await membership.canJoin(alice, id)).toBe(true);
  });

  it('requires authentication and rejects locked accounts', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/meetups')
      .send(body())
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/meetups')
      .set(auth(locked))
      .send(body())
      .expect(403);
  });

  it.each([
    { inviteeIds: [] },
    { inviteeIds: [bob, bob.toUpperCase()] },
    { inviteeIds: [alice] },
    { inviteeIds: [carol] },
    { scheduledAt: '2020-01-01T00:00:00Z' },
    { scheduledAt: '2030-01-01T12:00:00' },
    { searchRadiusM: 50001 },
    { recommendationMode: null },
    { status: 'selected' },
    { organizerId: bob },
  ])('rejects invalid create request %j without writes', async (patch) => {
    await request(app.getHttpServer())
      .post('/api/v1/meetups')
      .set(auth(alice))
      .send({ ...body(), ...patch })
      .expect(400);
    expect(store.rows.size).toBe(0);
    expect(store.deliveries).toHaveLength(0);
  });

  it('enforces organizer-only edits and protects status and null values', async () => {
    const id = await create();
    await request(app.getHttpServer())
      .patch(`/api/v1/meetups/${id}`)
      .set(auth(bob))
      .send({ recommendationMode: 'balanced' })
      .expect(403);
    for (const patch of [
      {},
      { title: null },
      { recommendationMode: 'fastest' },
      { status: 'selected' },
    ]) {
      await request(app.getHttpServer())
        .patch(`/api/v1/meetups/${id}`)
        .set(auth(alice))
        .send(patch)
        .expect(400);
    }
    await request(app.getHttpServer())
      .patch(`/api/v1/meetups/${id.toUpperCase()}`)
      .set(auth(alice))
      .send({ title: 'Tea', description: null, recommendationMode: 'balanced' })
      .expect(200);
    expect(store.rows.get(id)?.title).toBe('Tea');
  });

  it('accepts then revokes location access and detail access immediately on leave', async () => {
    const id = await create();
    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${id}/invitations/accept`)
      .set(auth(bob))
      .expect(200);
    expect(await membership.canRead(alice, bob, id)).toBe(true);
    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${id}/invitations/accept`)
      .set(auth(bob))
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${id}/leave`)
      .set(auth(alice))
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${id}/leave`)
      .set(auth(bob))
      .expect(200);
    expect(await membership.canRead(alice, bob, id)).toBe(false);
    expect(await membership.canPublish(bob, id)).toBe(false);
    await request(app.getHttpServer())
      .get(`/api/v1/meetups/${id}`)
      .set(auth(bob))
      .expect(404);
  });

  it('rejects, reinvites and removes without creating duplicate participants', async () => {
    const id = await create();
    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${id}/invitations/reject`)
      .set(auth(bob))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${id}/invitations`)
      .set(auth(alice))
      .send({ inviteeIds: [bob] })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${id}/invitations`)
      .set(auth(alice))
      .send({ inviteeIds: [bob] })
      .expect(409);
    await request(app.getHttpServer())
      .delete(`/api/v1/meetups/${id}/participants/${bob}`)
      .set(auth(alice))
      .expect(200);
    expect(store.rows.get(id)?.participants).toHaveLength(2);
    expect(await membership.canJoin(bob, id)).toBe(false);
  });

  it('blocks expired responses and closed meetup changes', async () => {
    const id = await create();
    store.rows.get(id)!.invitationDeadlineAt = new Date(Date.now() - 1);
    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${id}/invitations/accept`)
      .set(auth(bob))
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${id}/finish`)
      .set(auth(alice))
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${id}/cancel`)
      .set(auth(bob))
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/meetups/${id}/cancel`)
      .set(auth(alice))
      .expect(200);
    expect(await membership.canPublish(alice, id)).toBe(false);
    await request(app.getHttpServer())
      .patch(`/api/v1/meetups/${id}`)
      .set(auth(alice))
      .send({ title: 'Changed' })
      .expect(409);
  });

  it('limits reads to visible memberships and validates pagination and UUIDs', async () => {
    const id = await create();
    await request(app.getHttpServer())
      .get(`/api/v1/meetups/${id}`)
      .set(auth(carol))
      .expect(404);
    const response = await request(app.getHttpServer())
      .get('/api/v1/meetups')
      .set(auth(carol))
      .expect(200);
    expect(response.body).toMatchObject({ items: [], total: 0 });
    await request(app.getHttpServer())
      .get('/api/v1/meetups?limit=0')
      .set(auth(alice))
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/meetups/not-a-uuid')
      .set(auth(alice))
      .expect(400);
  });
});
