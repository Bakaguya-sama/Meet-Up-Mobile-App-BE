import { Global, Module } from '@nestjs/common';
import { PRESENCE } from '../../shared-kernel/application/presence.port';
import { REALTIME_PUBLISHER } from '../../shared-kernel/application/realtime-publisher.port';
import { PresenceAdapter } from './presence.adapter';
import { RealtimePublisherAdapter } from './realtime-publisher.adapter';

@Global()
@Module({
  providers: [
    RealtimePublisherAdapter,
    PresenceAdapter,
    { provide: REALTIME_PUBLISHER, useExisting: RealtimePublisherAdapter },
    { provide: PRESENCE, useExisting: PresenceAdapter },
  ],
  exports: [REALTIME_PUBLISHER, PRESENCE],
})
export class RealtimeModule {}
