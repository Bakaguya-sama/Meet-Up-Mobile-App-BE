import {
  Controller,
  Get,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { OutboxWorkerService } from '../../../infrastructure/outbox/outbox-worker.service';

@ApiTags('system')
@Controller('health')
export class HealthController {
  constructor(
    @Optional() private readonly database?: DataSource,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly outbox?: OutboxWorkerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check whether the API process is running' })
  check(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Check PostgreSQL, Redis and outbox worker readiness',
  })
  async ready(): Promise<{
    status: 'ready';
    dependencies: Record<string, 'up'>;
  }> {
    const dependencies: Record<string, 'up'> = {};
    try {
      if (!this.database || !this.redis || !this.outbox)
        throw new Error('runtime dependency unavailable');
      await this.database.query('SELECT 1');
      dependencies.postgres = 'up';
      await this.redis.commandClient.ping();
      dependencies.redis = 'up';
      if (!this.outbox.isReady()) throw new Error('outbox worker unavailable');
      dependencies.outboxWorker = 'up';
    } catch {
      throw new ServiceUnavailableException({ status: 'not_ready' });
    }
    return { status: 'ready', dependencies };
  }
}
