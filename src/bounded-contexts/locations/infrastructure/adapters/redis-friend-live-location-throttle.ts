import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import type { LocationSample } from '../../domain/location-visibility';
import type { FriendLiveLocationThrottle } from '../../application/services/friend-live-location-fanout.service';

const TRANSITION = `
local old = redis.call('GET', KEYS[1])
if not old then redis.call('SET', KEYS[1], ARGV[1], 'EX', 300); return 1 end
local previous = cjson.decode(old)
local next = cjson.decode(ARGV[1])
local elapsed = next.t - previous.t
local r = math.pi / 180
local dlat = (next.lat - previous.lat) * r
local dlon = (next.lng - previous.lng) * r
local x = math.sin(dlat / 2)^2 + math.cos(previous.lat * r) * math.cos(next.lat * r) * math.sin(dlon / 2)^2
local distance = 6371000 * 2 * math.atan2(math.sqrt(x), math.sqrt(1 - x))
if elapsed >= 10000 or distance >= 25 then redis.call('SET', KEYS[1], ARGV[1], 'EX', 300); return 1 end
return 0`;

@Injectable()
export class RedisFriendLiveLocationThrottle implements FriendLiveLocationThrottle {
  constructor(private readonly redis: RedisService) {}

  async shouldEmit(ownerId: string, sample: LocationSample): Promise<boolean> {
    const result = await this.redis.commandClient.eval(
      TRANSITION,
      1,
      `friend-live-last:${ownerId.toLowerCase()}`,
      JSON.stringify({
        lat: sample.latitude,
        lng: sample.longitude,
        t: sample.recordedAt.getTime(),
      }),
    );
    return result === 1;
  }
}
