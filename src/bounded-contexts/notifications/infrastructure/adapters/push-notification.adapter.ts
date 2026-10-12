import { Injectable } from '@nestjs/common';
import type { PushNotificationPort } from '../../application/ports/push-notification.port';

/** Default adapter until a Firebase test project is explicitly enabled. */
@Injectable()
export class PushNotificationAdapter implements PushNotificationPort {
  send(): Promise<void> {
    // Deliberately no-op: notification payloads and device tokens must never be logged.
    return Promise.resolve();
  }
}
