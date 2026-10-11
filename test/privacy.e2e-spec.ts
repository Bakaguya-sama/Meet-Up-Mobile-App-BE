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
import { AccessTokenGuard } from '../src/presentation/http/guards/access-token.guard';
import { PrivacyController } from '../src/bounded-contexts/auth/presentation/http/privacy.controller';
import { GetPrivacySettingsUseCase } from '../src/bounded-contexts/auth/application/use-cases/get-privacy-settings.use-case';
import { SavePrivacySettingsUseCase } from '../src/bounded-contexts/auth/application/use-cases/save-privacy-settings.use-case';
import { RemoveSelectedFriendUseCase } from '../src/bounded-contexts/auth/application/use-cases/remove-selected-friend.use-case';
import { PrivacySettings } from '../src/bounded-contexts/auth/domain/aggregates/privacy-settings.aggregate';
import type { PrivacySettingsStorePort } from '../src/bounded-contexts/auth/application/ports/persistence/privacy-settings-store.port';
import type { UserDirectory } from '../src/bounded-contexts/auth/application/public/user-directory';
import { LocationPermissionController } from '../src/bounded-contexts/locations/presentation/http/location-permission.controller';
import { LocationAccessService } from '../src/bounded-contexts/locations/application/services/location-access.service';

describe('Location privacy HTTP contract', () => {
  const owner = 'aaaaaaaa-0000-4000-8000-000000000001';
  const viewer = 'bbbbbbbb-0000-4000-8000-000000000002';
  const outsider = 'cccccccc-0000-4000-8000-000000000003';
  const settings = new Map<string, PrivacySettings>();
  let accepted = true;
  let app: INestApplication<App>;
  const auth = (userId: string) => ({ Authorization: `Bearer ${userId}` });
  const enabled = {
    sharingMode: 'friends',
    sharingExpiresAt: null,
    useApproximateLocation: true,
  };

  beforeAll(async () => {
    const store: PrivacySettingsStorePort = {
      findByUserId: (userId) => Promise.resolve(settings.get(userId) ?? null),
      save: (value) => {
        settings.set(value.snapshot().userId, value);
        return Promise.resolve();
      },
    };
    const users: UserDirectory = {
      search: () => Promise.resolve({ items: [], total: 0 }),
      findActiveByIds: (ids) =>
        Promise.resolve(
          ids
            .filter((id) => [owner, viewer, outsider].includes(id))
            .map((id) => ({ id, displayName: id, avatarUrl: null })),
        ),
    };
    const get = new GetPrivacySettingsUseCase(store, users);
    const save = new SavePrivacySettingsUseCase(store, users, get);
    const remove = new RemoveSelectedFriendUseCase(store);
    const access = new LocationAccessService(get, {
      areAccepted: (a, b) =>
        Promise.resolve(accepted && a === owner && b === viewer),
    });
    const fixture = await Test.createTestingModule({
      controllers: [PrivacyController, LocationPermissionController],
      providers: [
        {
          provide: ConfigService,
          useValue: new ConfigService({
            app: { apiPrefix: 'api/v1', swaggerEnabled: true },
          }),
        },
        { provide: GetPrivacySettingsUseCase, useValue: get },
        { provide: SavePrivacySettingsUseCase, useValue: save },
        { provide: RemoveSelectedFriendUseCase, useValue: remove },
        { provide: LocationAccessService, useValue: access },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context
            .switchToHttp()
            .getRequest<Request & { user: { id: string } }>();
          const id = req.headers.authorization?.replace('Bearer ', '');
          if (!id || ![owner, viewer, outsider].includes(id))
            throw new UnauthorizedException();
          req.user = { id };
          return true;
        },
      })
      .compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
  });
  beforeEach(() => {
    settings.clear();
    accepted = true;
  });
  afterAll(async () => {
    await app?.close();
  });

  it('requires authentication to read, change or check location privacy', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/privacy').expect(401);
    await request(app.getHttpServer())
      .put('/api/v1/auth/privacy')
      .send(enabled)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/api/v1/locations/permissions/${owner}`)
      .expect(401);
  });

  it('returns disabled defaults and only lets an actor change their own settings', async () => {
    const defaults = await request(app.getHttpServer())
      .get('/api/v1/auth/privacy')
      .set(auth(owner))
      .expect(200);
    expect(defaults.body).toMatchObject({
      sharingMode: 'off',
      isLocationSharingEnabled: false,
      updatedAt: null,
    });
    await request(app.getHttpServer())
      .put('/api/v1/auth/privacy')
      .set(auth(owner))
      .send({ ...enabled, userId: viewer })
      .expect(400);
    const saved = await request(app.getHttpServer())
      .put('/api/v1/auth/privacy')
      .set(auth(owner))
      .send(enabled)
      .expect(200);
    expect(saved.body).toMatchObject({
      sharingMode: 'friends',
      isLocationSharingEnabled: true,
      selectedFriendIds: [],
      nearbyFeatureEnabled: false,
    });
    expect(saved.headers['cache-control']).toBe('no-store');
    const other = await request(app.getHttpServer())
      .get('/api/v1/auth/privacy')
      .set(auth(viewer))
      .expect(200);
    expect(other.body).toMatchObject({
      sharingMode: 'off',
      isLocationSharingEnabled: false,
    });
  });

  it('checks viewer identity and current server-side friendship on each request', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/auth/privacy')
      .set(auth(owner))
      .send(enabled)
      .expect(200);
    const allowed = await request(app.getHttpServer())
      .get(`/api/v1/locations/permissions/${owner}`)
      .set(auth(viewer))
      .expect(200);
    expect(allowed.body).toEqual({
      allowed: true,
      precision: 'approximate',
      expiresAt: null,
    });
    const denied = await request(app.getHttpServer())
      .get(`/api/v1/locations/permissions/${owner}`)
      .set(auth(outsider))
      .expect(200);
    expect(denied.body).toEqual({
      allowed: false,
      precision: null,
      expiresAt: null,
    });
    accepted = false;
    const removed = await request(app.getHttpServer())
      .get(`/api/v1/locations/permissions/${owner}`)
      .set(auth(viewer))
      .expect(200);
    expect(removed.body).toMatchObject({ allowed: false });
    await request(app.getHttpServer())
      .get(
        `/api/v1/locations/permissions/${owner}?isFriend=true&viewerId=${owner}`,
      )
      .set(auth(viewer))
      .expect(400);
  });

  it('applies selected audiences and revokes access immediately after turning sharing off', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/auth/privacy')
      .set(auth(owner))
      .send({
        ...enabled,
        sharingMode: 'selected_friends',
        selectedFriendIds: [viewer.toUpperCase()],
      })
      .expect(200);
    const allowed = await request(app.getHttpServer())
      .get(`/api/v1/locations/permissions/${owner}`)
      .set(auth(viewer))
      .expect(200);
    expect(allowed.body).toMatchObject({ allowed: true });
    await request(app.getHttpServer())
      .put('/api/v1/auth/privacy')
      .set(auth(owner))
      .send({ ...enabled, sharingMode: 'off', nearbyFeatureEnabled: true })
      .expect(200);
    const denied = await request(app.getHttpServer())
      .get(`/api/v1/locations/permissions/${owner}`)
      .set(auth(viewer))
      .expect(200);
    expect(denied.body).toMatchObject({ allowed: false });
  });

  it('rejects malformed values, hidden enable flags, ambiguous dates and invalid selections', async () => {
    for (const body of [
      { ...enabled, sharingMode: 'everyone' },
      { ...enabled, sharingMode: null },
      { ...enabled, useApproximateLocation: 'true' },
      { ...enabled, useApproximateLocation: null },
      { ...enabled, nearbyFeatureEnabled: null },
      { ...enabled, isLocationSharingEnabled: true },
      { ...enabled, sharingExpiresAt: 'not-a-date' },
      { ...enabled, sharingExpiresAt: '2020-01-01T00:00:00Z' },
      { ...enabled, sharingExpiresAt: '2099-01-01T00:00:00' },
      { ...enabled, sharingExpiresAt: '2099-02-30T00:00:00Z' },
      {
        ...enabled,
        sharingMode: 'off',
        sharingExpiresAt: '2099-01-01T00:00:00Z',
      },
      { sharingMode: 'friends', useApproximateLocation: false },
      { ...enabled, selectedFriendIds: [viewer] },
      { ...enabled, sharingMode: 'selected_friends' },
      {
        ...enabled,
        sharingMode: 'selected_friends',
        selectedFriendIds: [owner],
      },
      {
        ...enabled,
        sharingMode: 'selected_friends',
        selectedFriendIds: [viewer, viewer.toUpperCase()],
      },
      {
        ...enabled,
        sharingMode: 'selected_friends',
        selectedFriendIds: ['invalid'],
      },
      { ...enabled, selectedFriendIds: null },
    ]) {
      await request(app.getHttpServer())
        .put('/api/v1/auth/privacy')
        .set(auth(owner))
        .send(body)
        .expect(400);
    }
    expect(settings.size).toBe(0);
  });

  it('preserves expiry in UTC and does not reveal another users settings', async () => {
    const saved = await request(app.getHttpServer())
      .put('/api/v1/auth/privacy')
      .set(auth(owner))
      .send({ ...enabled, sharingExpiresAt: '2099-01-01T07:00:00+07:00' })
      .expect(200);
    expect(saved.body).toMatchObject({
      sharingExpiresAt: '2099-01-01T00:00:00.000Z',
    });
    const result = await request(app.getHttpServer())
      .get(`/api/v1/locations/permissions/${owner}`)
      .set(auth(outsider))
      .expect(200);
    expect(result.body).toEqual({
      allowed: false,
      precision: null,
      expiresAt: null,
    });
  });

  it('denies meetup-only access without a server-side membership source', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/auth/privacy')
      .set(auth(owner))
      .send({ ...enabled, sharingMode: 'meetup_only' })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/locations/permissions/${owner}?scope=meetup`)
      .set(auth(viewer))
      .expect(400);
    const result = await request(app.getHttpServer())
      .get(
        `/api/v1/locations/permissions/${owner}?scope=meetup&meetupId=${outsider}`,
      )
      .set(auth(viewer))
      .expect(200);
    expect(result.body).toMatchObject({ allowed: false });
  });

  it('publishes the privacy endpoints in Swagger', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const paths = (response.body as { paths: Record<string, unknown> }).paths;
    expect(paths['/api/v1/auth/privacy']).toBeDefined();
    expect(paths['/api/v1/locations/permissions/{ownerId}']).toBeDefined();
    expect(
      paths['/api/v1/auth/privacy/selected-friends/{friendId}'],
    ).toBeDefined();
  });

  it('removes one friend from the selected list and is idempotent', async () => {
    // Set up selected_friends mode with owner → [viewer]
    await request(app.getHttpServer())
      .put('/api/v1/auth/privacy')
      .set(auth(owner))
      .send({
        ...enabled,
        sharingMode: 'selected_friends',
        selectedFriendIds: [viewer],
      })
      .expect(200);

    // viewer can see owner
    const before = await request(app.getHttpServer())
      .get(`/api/v1/locations/permissions/${owner}`)
      .set(auth(viewer))
      .expect(200);
    expect(before.body).toMatchObject({ allowed: true });

    // Remove viewer from selected list
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/privacy/selected-friends/${viewer}`)
      .set(auth(owner))
      .expect(204);

    // viewer can no longer see owner (mode downgraded to friends, but viewer IS a friend, so check stays true)
    // The key assertion: selectedFriendIds is now empty and mode changed
    const settings = await request(app.getHttpServer())
      .get('/api/v1/auth/privacy')
      .set(auth(owner))
      .expect(200);
    expect(settings.body).toMatchObject({
      selectedFriendIds: [],
      sharingMode: 'friends',
    });

    // Idempotent: second call also returns 204
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/privacy/selected-friends/${viewer}`)
      .set(auth(owner))
      .expect(204);
  });

  it("cannot remove a selected viewer from another owner's settings", async () => {
    for (const actor of [owner, outsider]) {
      await request(app.getHttpServer())
        .put('/api/v1/auth/privacy')
        .set(auth(actor))
        .send({
          ...enabled,
          sharingMode: 'selected_friends',
          selectedFriendIds: [viewer],
        })
        .expect(200);
    }

    await request(app.getHttpServer())
      .delete(`/api/v1/auth/privacy/selected-friends/${viewer}`)
      .set(auth(outsider))
      .expect(204);

    const ownerSettings = await request(app.getHttpServer())
      .get('/api/v1/auth/privacy')
      .set(auth(owner))
      .expect(200);
    expect(ownerSettings.body).toMatchObject({
      sharingMode: 'selected_friends',
      selectedFriendIds: [viewer],
    });
  });

  it('rejects invalid UUID in DELETE selected-friends', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/auth/privacy/selected-friends/not-a-uuid')
      .set(auth(owner))
      .expect(400);
  });

  it('requires authentication on DELETE selected-friends', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/privacy/selected-friends/${viewer}`)
      .expect(401);
  });
});
