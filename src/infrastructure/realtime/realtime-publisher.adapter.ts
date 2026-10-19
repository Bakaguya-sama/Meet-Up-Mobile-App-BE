import { Injectable } from '@nestjs/common';
import type {
  RealtimeMessage,
  RealtimePublisherPort,
} from '../../shared-kernel/application/realtime-publisher.port';
import type { Server } from 'socket.io';

@Injectable()
export class RealtimePublisherAdapter implements RealtimePublisherPort {
  private server?: Pick<Server, 'to'>;

  bindServer(server: Pick<Server, 'to'>): void {
    this.server = server;
  }

  publish(message: RealtimeMessage): Promise<void> {
    if (!this.server)
      return Promise.reject(
        new Error('Realtime Socket.IO server is not ready'),
      );
    this.server.to(message.room).emit(message.eventName, message.payload);
    return Promise.resolve();
  }
}
