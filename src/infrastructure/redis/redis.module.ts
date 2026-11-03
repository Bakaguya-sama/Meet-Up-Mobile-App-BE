import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';
import { RedisRateLimiter } from './redis-rate-limiter.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.getOrThrow<string>('redis.url'), {
          lazyConnect: true,
          connectTimeout: 5_000,
          commandTimeout: 5_000,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          enableReadyCheck: true,
          retryStrategy: (attempt) =>
            attempt <= 3 ? Math.min(attempt * 200, 1_000) : null,
        }),
    },
    RedisService,
    RedisRateLimiter,
  ],
  exports: [RedisService, RedisRateLimiter, REDIS_CLIENT],
})
export class RedisModule {}
