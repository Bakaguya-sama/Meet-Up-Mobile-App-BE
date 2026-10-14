import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { isIntegrationEvent } from '../../shared-kernel/application/integration-event.contract';
import { OutboxDispatcher } from './outbox-dispatcher.service';
import { OutboxEventTypeOrmEntity } from './persistence/outbox-event.typeorm-entity';

const OUTBOX_QUEUE = 'outbox-delivery';
const POLL_INTERVAL_MS = 5_000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class OutboxWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly connection: Redis;
  private readonly queue: Queue<{ eventId: string }>;
  private readonly worker: Worker<{ eventId: string }>;
  private pollTimer?: NodeJS.Timeout;

  constructor(
    config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly dispatcher: OutboxDispatcher,
  ) {
    this.connection = new Redis(config.getOrThrow<string>('redis.url'), {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
    this.queue = new Queue(OUTBOX_QUEUE, { connection: this.connection });
    this.worker = new Worker(
      OUTBOX_QUEUE,
      async (job) => this.deliver(job.data.eventId, job.attemptsMade + 1),
      { connection: this.connection },
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.enqueuePending();
    this.pollTimer = setInterval(() => {
      void this.enqueuePending();
    }, POLL_INTERVAL_MS);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
    await this.worker.close();
    await this.queue.close();
    await this.connection.quit();
  }

  private async enqueuePending(): Promise<void> {
    const events = await this.dataSource
      .getRepository(OutboxEventTypeOrmEntity)
      .find({
        where: { status: 'pending' },
        order: { createdAt: 'ASC' },
        take: 100,
      });

    await Promise.all(
      events.map((event) =>
        this.queue.add(
          'deliver',
          { eventId: event.id },
          {
            jobId: event.id,
            attempts: MAX_ATTEMPTS,
            backoff: { type: 'exponential', delay: 1_000 },
            removeOnComplete: true,
            removeOnFail: true,
          },
        ),
      ),
    );
  }

  private async deliver(eventId: string, attemptNumber: number): Promise<void> {
    const repository = this.dataSource.getRepository(OutboxEventTypeOrmEntity);
    const event = await repository.findOneBy({ id: eventId });
    if (!event || event.status === 'delivered') {
      return;
    }
    if (!isIntegrationEvent(event.payload)) {
      await repository.update(eventId, {
        status: 'failed',
        attemptCount: attemptNumber,
        lastError: 'Event schema is invalid',
      });
      return;
    }

    try {
      await this.dispatcher.dispatch(
        event.payload,
        event.destination,
        event.recipientIds,
      );
      await repository.update(eventId, {
        status: 'delivered',
        attemptCount: attemptNumber,
        deliveredAt: new Date(),
        lastError: null,
      });
    } catch (error) {
      await repository.update(eventId, {
        status: attemptNumber >= MAX_ATTEMPTS ? 'failed' : 'pending',
        attemptCount: attemptNumber,
        lastError: sanitizeError(error),
      });
      if (attemptNumber >= MAX_ATTEMPTS) {
        return;
      }
      throw error;
    }
  }
}

function sanitizeError(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 500)
    : 'Unknown delivery failure';
}
