import { Global, Module } from '@nestjs/common';
import { PUSH_NOTIFICATION } from './application/ports/push-notification.port';
import { PushNotificationAdapter } from './infrastructure/adapters/push-notification.adapter';

@Global()
@Module({
  providers: [
    PushNotificationAdapter,
    {
      provide: PUSH_NOTIFICATION,
      useExisting: PushNotificationAdapter,
    },
  ],
  exports: [PUSH_NOTIFICATION],
})
export class NotificationsModule {}
