import { Injectable, TooManyRequestsException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RedisService } from './redis.service';

const WINDOW_SECONDS = 60;
const INCREMENT_WITH_TTL = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
  return count
`;

@Injectable()
export class RedisRateLimiter {
  constructor(private readonly redis: RedisService) {}

  async assertAllowed(scope: string, identity: string, limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error(`Invalid rate limit configuration for ${scope}`);
    }
    const now = Date.now();
    const window = Math.floor(now / (WINDOW_SECONDS * 1000));
    const ttlSeconds = Math.max(
      1,
      Math.ceil(((window + 1) * WINDOW_SECONDS * 1000 - now) / 1000),
    );
    const identityHash = createHash('sha256')
      .update(identity, 'utf8')
      .digest('hex');
    const key = `rate-limit:v1:${scope}:${window}:${identityHash}`;
    const count = Number(
      await this.redis.commandClient.eval(
        INCREMENT_WITH_TTL,
        1,
        key,
        ttlSeconds,
      ),
    );
    if (count > limit) {
      throw new TooManyRequestsException({
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: 'Too many requests',
      });
    }
  }
}
