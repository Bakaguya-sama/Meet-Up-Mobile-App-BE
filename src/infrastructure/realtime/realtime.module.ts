import { Global, Module } from '@nestjs/common';
import { REALTIME_PUBLISHER } from '../../shared-kernel/application/realtime-publisher.port';
import { RealtimePublisherAdapter } from './realtime-publisher.adapter';

@Global()
@Module({
  providers: [
    RealtimePublisherAdapter,
    { provide: REALTIME_PUBLISHER, useExisting: RealtimePublisherAdapter },
  ],
  exports: [REALTIME_PUBLISHER],
})
export class RealtimeModule {}
