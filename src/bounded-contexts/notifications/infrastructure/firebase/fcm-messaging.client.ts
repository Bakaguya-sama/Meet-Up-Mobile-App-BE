import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

export const FCM_MESSAGING_CLIENT = Symbol('FCM_MESSAGING_CLIENT');

export type FcmNotificationMessage = {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

export interface FcmMessagingClientPort {
  send(message: FcmNotificationMessage): Promise<void>;
}

@Injectable()
export class FcmMessagingClient implements FcmMessagingClientPort {
  private readonly messaging: Messaging | null;

  constructor(config: ConfigService) {
    if (!config.get<boolean>('firebase.enabled')) {
      this.messaging = null;
      return;
    }

    const app =
      getApps().find((candidate) => candidate.name === 'meetup-fcm') ??
      initializeApp(
        {
          credential: cert({
            projectId: config.getOrThrow<string>('firebase.projectId'),
            clientEmail: config.getOrThrow<string>('firebase.clientEmail'),
            privateKey: config
              .getOrThrow<string>('firebase.privateKey')
              .replace(/\\n/g, '\n'),
          }),
        },
        'meetup-fcm',
      );
    this.messaging = getMessaging(app);
  }

  async send(message: FcmNotificationMessage): Promise<void> {
    if (!this.messaging) return;
    await this.messaging.send({
      token: message.token,
      notification: { title: message.title, body: message.body },
      data: message.data,
    });
  }
}
