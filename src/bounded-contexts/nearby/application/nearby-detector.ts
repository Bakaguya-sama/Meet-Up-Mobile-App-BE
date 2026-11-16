import { randomUUID } from 'node:crypto';
import {
  canViewLocation,
  isSharingActive,
  validateLocationSample,
  type LocationSample,
} from '../../locations/domain/location-visibility';
import type { FriendshipReader } from '../../friends/application/public/friendship-reader';
import type { LocationPrivacyReader } from '../../auth/application/public/location-privacy-reader';
import type { LocationPort } from '../../locations/application/ports/location.port';

export interface NearbyPairStatePort {
  transition(pair: string, isNear: boolean, eventId: string): Promise<boolean>;
  compensate(pair: string, eventId: string): Promise<void>;
}
export interface NearbyOutboxPort {
  enqueue(input: {
    eventIdA: string;
    eventIdB: string;
    userAId: string;
    userBId: string;
    occurredAt: Date;
  }): Promise<void>;
}

export class NearbyDetector {
  constructor(
    private readonly friendships: FriendshipReader,
    private readonly privacy: LocationPrivacyReader,
    private readonly locations: LocationPort,
    private readonly pairs: NearbyPairStatePort,
    private readonly outbox: NearbyOutboxPort,
    private readonly radiusMeters = 3_000,
  ) {}

  async detect(ownerId: string, now = new Date()): Promise<void> {
    const owner = await this.eligible(ownerId, now);
    const ownerLocation = await this.freshLocation(ownerId, now);
    if (!owner || !ownerLocation) return;
    for (const friendId of await this.friendships.acceptedFriendIds(ownerId)) {
      const friend = await this.eligible(friendId, now);
      const friendLocation = await this.freshLocation(friendId, now);
      if (
        !friend ||
        !friendLocation ||
        !allows(ownerId, friendId, owner, friend, now)
      )
        continue;
      const pair = normalizedPair(ownerId, friendId);
      const near =
        distanceMeters(ownerLocation, friendLocation) <= this.radiusMeters;
      const eventIdA = randomUUID();
      if (!(await this.pairs.transition(pair, near, eventIdA))) continue;
      const eventIdB = randomUUID();
      try {
        await this.outbox.enqueue({
          eventIdA,
          eventIdB,
          userAId: ownerId,
          userBId: friendId,
          occurredAt: now,
        });
      } catch (error) {
        await this.pairs.compensate(pair, eventIdA);
        throw error;
      }
    }
  }

  private async eligible(userId: string, now: Date) {
    const value = await this.privacy.read(userId);
    return value?.nearbyFeatureEnabled &&
      value.isLocationSharingEnabled &&
      isSharingActive(value, now)
      ? value
      : null;
  }
  private async freshLocation(userId: string, now: Date) {
    const sample = await this.locations.get(userId);
    if (!sample) return null;
    try {
      validateLocationSample(sample, now);
      return sample;
    } catch {
      return null;
    }
  }
}

export function normalizedPair(a: string, b: string) {
  return [a.toLowerCase(), b.toLowerCase()].sort().join(':');
}
function allows(
  a: string,
  b: string,
  pa: NonNullable<Awaited<ReturnType<LocationPrivacyReader['read']>>>,
  pb: NonNullable<Awaited<ReturnType<LocationPrivacyReader['read']>>>,
  now: Date,
) {
  return (
    canViewLocation(
      pa,
      {
        ownerId: a,
        viewerId: b,
        scope: 'friends',
        acceptedFriend: true,
        acceptedMeetupMember: false,
      },
      now,
    ) &&
    canViewLocation(
      pb,
      {
        ownerId: b,
        viewerId: a,
        scope: 'friends',
        acceptedFriend: true,
        acceptedMeetupMember: false,
      },
      now,
    )
  );
}
function distanceMeters(a: LocationSample, b: LocationSample) {
  const r = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * r;
  const dLon = (b.longitude - a.longitude) * r;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * r) *
      Math.cos(b.latitude * r) *
      Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
