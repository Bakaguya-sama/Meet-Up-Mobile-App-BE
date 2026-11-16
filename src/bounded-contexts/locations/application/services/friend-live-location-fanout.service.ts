import { randomUUID } from 'node:crypto';
import type { FriendshipReader } from '../../../friends/application/public/friendship-reader';
import type { LocationPort } from '../ports/location.port';
import { LocationAccessService } from './location-access.service';
import {
  realtimeRooms,
  type RealtimePublisherPort,
} from '../../../../shared-kernel/application/realtime-publisher.port';
import type { LocationSample } from '../../domain/location-visibility';

export interface FriendLiveLocationThrottle {
  shouldEmit(ownerId: string, sample: LocationSample): Promise<boolean>;
}

/** Best-effort Socket fan-out; raw coordinates never leave this service unprojected. */
export class FriendLiveLocationFanoutService {
  constructor(
    private readonly friends: FriendshipReader,
    private readonly locations: LocationPort,
    private readonly access: LocationAccessService,
    private readonly throttle: FriendLiveLocationThrottle,
    private readonly realtime: RealtimePublisherPort,
  ) {}

  async publish(ownerId: string): Promise<void> {
    const sample = await this.locations.get(ownerId);
    if (!sample || !(await this.throttle.shouldEmit(ownerId, sample))) return;
    await Promise.all(
      (await this.friends.acceptedFriendIds(ownerId)).map(async (viewerId) => {
        try {
          const location = await this.access.projectFriendLiveLocation(
            ownerId,
            viewerId,
            sample,
          );
          await this.realtime.publish({
            eventId: randomUUID(),
            room: realtimeRooms.user(viewerId),
            eventName: 'friend:location:updated',
            payload: { ownerId, location },
          });
        } catch {
          // Privacy, friendship or account state can change between recipient lookup and delivery.
        }
      }),
    );
  }
}
