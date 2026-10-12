import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../../bounded-contexts/notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { OutboxDispatcher } from './outbox-dispatcher.service';
import { OutboxWorkerService } from './outbox-worker.service';
import { OutboxEventTypeOrmEntity } from './persistence/outbox-event.typeorm-entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxEventTypeOrmEntity]),
    RealtimeModule,
    NotificationsModule,
  ],
  providers: [OutboxDispatcher, OutboxWorkerService],
})
export class OutboxModule {}
