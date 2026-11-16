import type { FriendshipReader } from '../../friends/application/public/friendship-reader';
import type { LocationPrivacyReader } from '../../auth/application/public/location-privacy-reader';
import type { LocationPort } from '../../locations/application/ports/location.port';
import {
  NearbyDetector,
  normalizedPair,
  type NearbyOutboxPort,
  type NearbyPairStatePort,
} from './nearby-detector';

describe('NearbyDetector', () => {
  const alice = 'aaaaaaaa-0000-4000-8000-000000000001';
  const bob = 'bbbbbbbb-0000-4000-8000-000000000002';
  const now = new Date('2026-11-15T05:00:00.000Z');
  let friendships: { acceptedFriendIds: jest.Mock };
  let privacy: { read: jest.Mock };
  let locations: { get: jest.Mock };
  let pairs: jest.Mocked<NearbyPairStatePort>;
  let outbox: jest.Mocked<NearbyOutboxPort>;

  beforeEach(() => {
    friendships = { acceptedFriendIds: jest.fn().mockResolvedValue([bob]) };
    privacy = {
      read: jest.fn().mockResolvedValue({
        sharingMode: 'friends',
        sharingExpiresAt: null,
        isLocationSharingEnabled: true,
        useApproximateLocation: false,
        nearbyFeatureEnabled: true,
        selectedFriendIds: [],
        updatedAt: null,
      }),
    };
    locations = {
      get: jest.fn((id: string) =>
        Promise.resolve({
          latitude: id === alice ? 10.77 : 10.78,
          longitude: 106.69,
          accuracy: 10,
          recordedAt: now,
        }),
      ),
    };
    pairs = {
      transition: jest.fn().mockResolvedValue(true),
      compensate: jest.fn().mockResolvedValue(undefined),
    };
    outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
  });

  const detector = () =>
    new NearbyDetector(
      friendships as unknown as FriendshipReader,
      privacy,
      locations as unknown as LocationPort,
      pairs,
      outbox,
    );

  it('normalizes both pair directions and enqueues a coordinate-free notification', async () => {
    expect(normalizedPair(alice, bob)).toBe(normalizedPair(bob, alice));
    await detector().detect(alice, now);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ userAId: alice, userBId: bob }),
    );
    expect(JSON.stringify(outbox.enqueue.mock.calls)).not.toMatch(
      /latitude|longitude|distance|address|token/i,
    );
  });

  it.each([
    { nearbyFeatureEnabled: false, isLocationSharingEnabled: true },
    { nearbyFeatureEnabled: true, isLocationSharingEnabled: false },
  ])(
    'does not notify when either privacy condition fails',
    async (override) => {
      privacy.read.mockImplementation((id: string) =>
        Promise.resolve({
          sharingMode:
            id === bob && !override.isLocationSharingEnabled
              ? 'off'
              : 'friends',
          sharingExpiresAt: null,
          isLocationSharingEnabled:
            id === bob ? override.isLocationSharingEnabled : true,
          useApproximateLocation: false,
          nearbyFeatureEnabled:
            id === bob ? override.nearbyFeatureEnabled : true,
          selectedFriendIds: [],
          updatedAt: null,
        }),
      );
      await detector().detect(alice, now);
      expect(outbox.enqueue).not.toHaveBeenCalled();
    },
  );

  it('does not notify non-friends or unavailable accounts', async () => {
    friendships.acceptedFriendIds.mockResolvedValueOnce([]);
    await detector().detect(alice, now);
    privacy.read.mockImplementation((id: string) =>
      Promise.resolve(id === bob ? null : privacyValue()),
    );
    await detector().detect(alice, now);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('does not notify for expired or selected-friend-denied sharing', async () => {
    privacy.read.mockImplementation((id: string) =>
      Promise.resolve({
        ...privacyValue(),
        sharingMode: id === bob ? 'selected_friends' : 'friends',
        selectedFriendIds: [],
      }),
    );
    await detector().detect(alice, now);
    privacy.read.mockImplementation((id: string) =>
      Promise.resolve({
        ...privacyValue(),
        sharingExpiresAt: id === bob ? new Date(now.getTime() - 1) : null,
      }),
    );
    await detector().detect(alice, now);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('treats exactly 3000 metres as near and a larger distance as outside', async () => {
    const equator = { latitude: 0, longitude: 0, accuracy: 1, recordedAt: now };
    const latitudeAtBoundary = (3_000 / 6_371_000) * (180 / Math.PI);
    locations.get.mockImplementation((id: string) =>
      Promise.resolve(
        id === alice ? equator : { ...equator, latitude: latitudeAtBoundary },
      ),
    );
    pairs.transition.mockImplementation((_pair, isNear) =>
      Promise.resolve(isNear),
    );
    await detector().detect(alice, now);
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    outbox.enqueue.mockClear();
    locations.get.mockImplementation((id: string) =>
      Promise.resolve(
        id === alice
          ? equator
          : { ...equator, latitude: latitudeAtBoundary + 0.00001 },
      ),
    );
    await detector().detect(alice, now);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('uses the injected radius instead of a fixed business constant', async () => {
    const detectorWithRadius = () =>
      new NearbyDetector(
        friendships as unknown as FriendshipReader,
        privacy,
        locations as unknown as LocationPort,
        pairs,
        outbox,
        500,
      );
    pairs.transition.mockImplementation((_pair, isNear) =>
      Promise.resolve(isNear),
    );
    await detectorWithRadius().detect(alice, now);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('rejects stale, future, invalid and outside-radius locations', async () => {
    pairs.transition.mockImplementation((_pair, isNear) =>
      Promise.resolve(isNear),
    );
    for (const sample of [
      {
        latitude: 10.78,
        longitude: 106.69,
        accuracy: 10,
        recordedAt: new Date(now.getTime() - 300_000),
      },
      {
        latitude: 10.78,
        longitude: 106.69,
        accuracy: 10,
        recordedAt: new Date(now.getTime() + 1),
      },
      { latitude: 91, longitude: 106.69, accuracy: 10, recordedAt: now },
      { latitude: 11.1, longitude: 106.69, accuracy: 10, recordedAt: now },
    ]) {
      locations.get.mockImplementation((id: string) =>
        Promise.resolve(
          id === alice
            ? {
                latitude: 10.77,
                longitude: 106.69,
                accuracy: 10,
                recordedAt: now,
              }
            : sample,
        ),
      );
      await detector().detect(alice, now);
    }
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('compensates the atomic claim when outbox persistence fails', async () => {
    outbox.enqueue.mockRejectedValue(new Error('database unavailable'));
    await expect(detector().detect(alice, now)).rejects.toThrow(
      'database unavailable',
    );
    expect(pairs.compensate).toHaveBeenCalledWith(
      normalizedPair(alice, bob),
      expect.any(String),
    );
  });
});

function privacyValue() {
  return {
    sharingMode: 'friends' as const,
    sharingExpiresAt: null,
    isLocationSharingEnabled: true,
    useApproximateLocation: false,
    nearbyFeatureEnabled: true,
    selectedFriendIds: [] as string[],
    updatedAt: null,
  };
}
