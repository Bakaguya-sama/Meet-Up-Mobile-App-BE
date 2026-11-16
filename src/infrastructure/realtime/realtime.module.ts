import { Global, Module } from '@nestjs/common';
import { PRESENCE } from '../../shared-kernel/application/presence.port';
import { REALTIME_PUBLISHER } from '../../shared-kernel/application/realtime-publisher.port';
import { PresenceAdapter } from './presence.adapter';
import { RealtimePublisherAdapter } from './realtime-publisher.adapter';
import { RealtimeFriendLiveLocationRevoker } from './friend-live-location-revoker.service';
import { FRIEND_LIVE_LOCATION_REVOKER } from '../../shared-kernel/application/friend-live-location-revoker.port';

@Global()
@Module({
  providers: [
    RealtimePublisherAdapter,
    RealtimeFriendLiveLocationRevoker,
    PresenceAdapter,
    { provide: REALTIME_PUBLISHER, useExisting: RealtimePublisherAdapter },
    { provide: PRESENCE, useExisting: PresenceAdapter },
    {
      provide: FRIEND_LIVE_LOCATION_REVOKER,
      useExisting: RealtimeFriendLiveLocationRevoker,
    },
  ],
  exports: [
    REALTIME_PUBLISHER,
    PRESENCE,
    FRIEND_LIVE_LOCATION_REVOKER,
    RealtimePublisherAdapter,
  ],
})
export class RealtimeModule {}
