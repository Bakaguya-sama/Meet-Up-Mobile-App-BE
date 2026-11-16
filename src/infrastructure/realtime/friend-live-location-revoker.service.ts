import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  REALTIME_PUBLISHER,
  realtimeRooms,
  type RealtimePublisherPort,
} from '../../shared-kernel/application/realtime-publisher.port';
import type { FriendLiveLocationRevokerPort } from '../../shared-kernel/application/friend-live-location-revoker.port';

@Injectable()
export class RealtimeFriendLiveLocationRevoker implements FriendLiveLocationRevokerPort {
  constructor(
    @Inject(REALTIME_PUBLISHER)
    private readonly realtime: RealtimePublisherPort,
  ) {}

  async revoke(
    ownerId: string,
    viewerId: string,
    reason: 'privacy_revoked' | 'friendship_removed' | 'blocked' | 'expired',
  ): Promise<void> {
    await this.realtime.publish({
      eventId: randomUUID(),
      room: realtimeRooms.user(viewerId),
      eventName: 'friend:location:unavailable',
      payload: { ownerId, reason },
    });
  }
}
