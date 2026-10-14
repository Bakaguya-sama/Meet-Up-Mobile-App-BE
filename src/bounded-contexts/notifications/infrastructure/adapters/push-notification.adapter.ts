import { Inject, Injectable } from '@nestjs/common';
import type { PushNotificationPort } from '../../application/ports/push-notification.port';
import {
  DEVICE_TOKEN_CIPHER,
  type DeviceTokenCipherPort,
} from '../../application/ports/device-token-cipher.port';
import {
  DEVICE_TOKEN_STORE,
  type DeviceTokenStorePort,
} from '../../application/ports/device-token-store.port';
import {
  FCM_MESSAGING_CLIENT,
  type FcmMessagingClientPort,
} from '../firebase/fcm-messaging.client';

@Injectable()
export class PushNotificationAdapter implements PushNotificationPort {
  constructor(
    @Inject(DEVICE_TOKEN_STORE) private readonly tokens: DeviceTokenStorePort,
    @Inject(DEVICE_TOKEN_CIPHER)
    private readonly cipher: DeviceTokenCipherPort,
    @Inject(FCM_MESSAGING_CLIENT)
    private readonly fcm: FcmMessagingClientPort,
  ) {}

  async send(
    input: Parameters<PushNotificationPort['send']>[0],
  ): Promise<void> {
    const tokens = await this.tokens.listActiveForUser(input.recipientId);
    const attempts = await Promise.allSettled(
      tokens.map(async (stored) => {
        try {
          await this.fcm.send({
            token: this.cipher.decrypt(stored.tokenCiphertext),
            title: input.title,
            body: input.body,
            data: {
              type: input.data.type,
              meetupId: input.data.meetupId,
              ...(input.data.placeId ? { placeId: input.data.placeId } : {}),
            },
          });
        } catch (error) {
          if (isInvalidRegistrationToken(error)) {
            await this.tokens.revoke(stored.id, new Date());
            return;
          }
          throw error;
        }
      }),
    );

    if (attempts.some((attempt) => attempt.status === 'rejected')) {
      // Do not retain FCM messages: providers can include sensitive device details.
      throw new Error('Push notification delivery failed');
    }
  }
}

function isInvalidRegistrationToken(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token'
  );
}
