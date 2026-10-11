import { LocationAccessService } from './location-access.service';
import type {
  LocationFriendshipsPort,
  LocationPrivacy,
  LocationPrivacyPort,
  MeetupLocationAccessPort,
} from '../ports/location-access.port';

describe('LocationAccessService', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const request = {
    ownerId: 'owner',
    viewerId: 'viewer',
    scope: 'friends' as const,
  };
  let settings: LocationPrivacy;
  let privacy: jest.Mocked<LocationPrivacyPort>;
  let friendships: jest.Mocked<LocationFriendshipsPort>;
  let meetups: jest.Mocked<MeetupLocationAccessPort>;
  let service: LocationAccessService;
  const sample = {
    latitude: 10.776923,
    longitude: 106.700947,
    accuracy: 12,
    recordedAt: now,
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    settings = {
      sharingMode: 'friends',
      sharingExpiresAt: null,
      useApproximateLocation: false,
      selectedFriendIds: [],
      updatedAt: new Date(now.getTime() - 1000),
    };
    privacy = { read: jest.fn(() => Promise.resolve({ ...settings })) };
    friendships = { areAccepted: jest.fn().mockResolvedValue(true) };
    meetups = {
      canPublish: jest.fn().mockResolvedValue(true),
      canRead: jest.fn().mockResolvedValue(true),
    };
    service = new LocationAccessService(privacy, friendships, meetups);
  });
  afterEach(() => jest.useRealTimers());

  it('checks current consent on every read and publish request', async () => {
    expect((await service.checkRead(request)).allowed).toBe(true);
    await expect(service.requirePublish('owner')).resolves.toBeUndefined();
    settings.sharingMode = 'off';
    expect((await service.checkRead(request)).allowed).toBe(false);
    await expect(
      service.projectForViewer(request, sample),
    ).rejects.toMatchObject({ code: 'LOCATION_ACCESS_DENIED' });
    await expect(service.requirePublish('owner')).rejects.toMatchObject({
      code: 'LOCATION_ACCESS_DENIED',
    });
  });

  it('does not grant access for missing, deleted or locked accounts', async () => {
    privacy.read.mockResolvedValueOnce(null);
    expect((await service.checkRead(request)).allowed).toBe(false);
    privacy.read.mockResolvedValueOnce(settings).mockResolvedValueOnce(null);
    expect((await service.checkRead(request)).allowed).toBe(false);
  });

  it('requires an accepted friendship even for a selected viewer and rechecks it every time', async () => {
    settings.sharingMode = 'selected_friends';
    settings.selectedFriendIds = ['viewer'];
    expect((await service.checkRead(request)).allowed).toBe(true);
    friendships.areAccepted.mockResolvedValue(false);
    expect((await service.checkRead(request)).allowed).toBe(false);
  });

  it('a selected audience cannot be bypassed by choosing meetup scope', async () => {
    settings.sharingMode = 'selected_friends';
    settings.selectedFriendIds = ['another-viewer'];
    expect((await service.checkRead(request)).allowed).toBe(false);
    expect(
      (
        await service.checkRead({
          ...request,
          scope: 'meetup',
          meetupId: 'meetup',
        })
      ).allowed,
    ).toBe(false);
  });

  it('expires exactly on the boundary and does not extend consent using an earlier check', async () => {
    settings.sharingExpiresAt = new Date(now.getTime() + 1000);
    expect((await service.checkRead(request)).allowed).toBe(true);
    jest.setSystemTime(settings.sharingExpiresAt);
    expect((await service.checkRead(request)).allowed).toBe(false);
    await expect(service.requirePublish('owner')).rejects.toMatchObject({
      code: 'LOCATION_ACCESS_DENIED',
    });
  });

  it('rechecks expiry after asynchronous audience verification', async () => {
    settings.sharingExpiresAt = new Date(now.getTime() + 1000);
    friendships.areAccepted.mockImplementation(() => {
      jest.setSystemTime(now.getTime() + 1000);
      return Promise.resolve(true);
    });
    expect((await service.checkRead(request)).allowed).toBe(false);
  });

  it('allows meetup-only sharing only after a server-side membership check', async () => {
    settings.sharingMode = 'meetup_only';
    expect((await service.checkRead(request)).allowed).toBe(false);
    expect(
      (
        await service.checkRead({
          ...request,
          scope: 'meetup',
          meetupId: 'meetup',
        })
      ).allowed,
    ).toBe(true);
    await expect(service.requirePublish('owner')).rejects.toMatchObject({
      code: 'LOCATION_ACCESS_DENIED',
    });
    await expect(
      service.requirePublish('owner', 'meetup'),
    ).resolves.toBeUndefined();
    meetups.canRead.mockResolvedValue(false);
    meetups.canPublish.mockResolvedValue(false);
    expect(
      (
        await service.checkRead({
          ...request,
          scope: 'meetup',
          meetupId: 'meetup',
        })
      ).allowed,
    ).toBe(false);
    await expect(
      service.requirePublish('owner', 'meetup'),
    ).rejects.toMatchObject({ code: 'LOCATION_ACCESS_DENIED' });
  });

  it('denies meetup access when the membership integration is unavailable', async () => {
    service = new LocationAccessService(privacy, friendships);
    settings.sharingMode = 'meetup_only';
    expect(
      (
        await service.checkRead({
          ...request,
          scope: 'meetup',
          meetupId: 'meetup',
        })
      ).allowed,
    ).toBe(false);
    await expect(
      service.requirePublish('owner', 'meetup'),
    ).rejects.toMatchObject({ code: 'LOCATION_ACCESS_DENIED' });
  });

  it('reduces precision at the server and drops arbitrary precise metadata', async () => {
    settings.useApproximateLocation = true;
    const result = await service.projectForViewer(request, {
      ...sample,
      address: 'private',
      originalLatitude: sample.latitude,
    } as typeof sample);
    expect(result).toEqual({
      latitude: 10.78,
      longitude: 106.7,
      accuracy: 1000,
      recordedAt: now,
      isApproximate: true,
    });
    settings.useApproximateLocation = false;
    expect(await service.projectForViewer(request, sample)).toEqual({
      ...sample,
      isApproximate: false,
    });
    settings.useApproximateLocation = true;
    expect(
      (await service.projectForViewer(request, { ...sample, accuracy: 2000 }))
        .accuracy,
    ).toBe(2000);
  });

  it.each([
    { ...sample, latitude: 91 },
    { ...sample, longitude: -181 },
    { ...sample, accuracy: -1 },
    { ...sample, latitude: Number.NaN },
    { ...sample, recordedAt: new Date('invalid') },
    { ...sample, recordedAt: new Date(now.getTime() + 1) },
    { ...sample, recordedAt: new Date(now.getTime() - 300000) },
  ])('never returns invalid, future or expired samples', async (invalid) => {
    settings.updatedAt = null;
    await expect(
      service.projectForViewer(request, invalid),
    ).rejects.toMatchObject({ code: 'LOCATION_ACCESS_DENIED' });
  });

  it('does not reshare a sample captured before the latest privacy change', async () => {
    settings.updatedAt = new Date(now.getTime() + 1);
    await expect(
      service.projectForViewer(request, sample),
    ).rejects.toMatchObject({ code: 'LOCATION_ACCESS_DENIED' });
  });
});
