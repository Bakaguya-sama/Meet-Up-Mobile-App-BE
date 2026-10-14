import { Injectable } from '@nestjs/common';
import type {
  RealtimeMessage,
  RealtimePublisherPort,
} from '../../shared-kernel/application/realtime-publisher.port';

/** Temporary transport for S0; the authenticated Socket.IO gateway replaces it in BE-06. */
@Injectable()
export class RealtimePublisherAdapter implements RealtimePublisherPort {
  readonly messages: RealtimeMessage[] = [];

  publish(message: RealtimeMessage): Promise<void> {
    this.messages.push(message);
    return Promise.resolve();
  }
}
