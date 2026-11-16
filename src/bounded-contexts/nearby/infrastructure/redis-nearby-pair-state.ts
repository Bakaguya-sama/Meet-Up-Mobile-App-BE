import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import type { NearbyPairStatePort } from '../application/nearby-detector';

const TRANSITION = `
local state = redis.call('GET', KEYS[1])
if ARGV[1] == '0' then
  redis.call('SET', KEYS[1], 'outside', 'EX', 604800)
  return 0
end
if state == 'inside' then return 0 end
if redis.call('EXISTS', KEYS[2]) == 1 then
  redis.call('SET', KEYS[1], 'inside', 'EX', 604800)
  return 0
end
redis.call('SET', KEYS[1], 'inside', 'EX', 604800)
redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[3], 'NX')
return 1`;
const COMPENSATE = `if redis.call('GET', KEYS[2]) == ARGV[1] then redis.call('DEL', KEYS[2]); redis.call('SET', KEYS[1], 'outside', 'EX', 604800); return 1 end return 0`;

@Injectable()
export class RedisNearbyPairState implements NearbyPairStatePort {
  constructor(private readonly redis: RedisService) {}
  async transition(pair: string, isNear: boolean, eventId: string) {
    const result = await this.redis.commandClient.eval(
      TRANSITION,
      2,
      `nearby-state:${pair}`,
      `nearby-cooldown:${pair}`,
      isNear ? '1' : '0',
      eventId,
      String(2 * 60 * 60 * 1000),
    );
    return result === 1;
  }
  async compensate(pair: string, eventId: string) {
    await this.redis.commandClient.eval(
      COMPENSATE,
      2,
      `nearby-state:${pair}`,
      `nearby-cooldown:${pair}`,
      eventId,
    );
  }
}
