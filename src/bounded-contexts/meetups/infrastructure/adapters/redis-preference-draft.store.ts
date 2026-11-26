import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import type {
  PreferenceDraftSession,
  PreferenceDraftStore,
} from '../../application/ports/preference-draft-store.port';

const key = (id: string) => `meetup-preference:v2:{${id}}`;
const SAVE = `
if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
if tonumber(ARGV[3]) <= 0 then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
return 1`;
const RELEASE = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0`;
const CONSUME = `
if redis.call('EXISTS', KEYS[2]) == 1 then return nil end
local raw = redis.call('GET', KEYS[1])
if not raw then return nil end
local draft = cjson.decode(raw)
if draft.actorId ~= ARGV[1] or draft.meetupId ~= ARGV[2] or draft.revision ~= tonumber(ARGV[3]) or draft.mode ~= 'proposal' or draft.expiresAt <= tonumber(ARGV[4]) then return nil end
draft.mode = 'consumed'
redis.call('SET', KEYS[1], cjson.encode(draft), 'KEEPTTL')
return raw`;
const LIMIT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count`;

@Injectable()
export class RedisPreferenceDraftStore implements PreferenceDraftStore {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async load(id: string): Promise<PreferenceDraftSession | null> {
    const raw = await this.redis.get(key(id));
    return raw ? (JSON.parse(raw) as PreferenceDraftSession) : null;
  }
  async acquire(id: string): Promise<string | null> {
    const lease = randomUUID();
    return (await this.redis.setIfAbsent(`${key(id)}:lock`, lease, 60_000))
      ? lease
      : null;
  }
  async save(session: PreferenceDraftSession, lease: string): Promise<void> {
    const written = await this.redis.commandClient.eval(
      SAVE,
      2,
      key(session.id),
      `${key(session.id)}:lock`,
      lease,
      JSON.stringify(session),
      Math.max(0, session.expiresAt - Date.now()),
    );
    if (Number(written) !== 1)
      throw new Error('Preference draft lease expired');
  }
  async release(id: string, lease: string): Promise<void> {
    await this.redis.commandClient.eval(RELEASE, 1, `${key(id)}:lock`, lease);
  }
  async consume(
    id: string,
    actorId: string,
    meetupId: string,
    revision: number,
  ): Promise<PreferenceDraftSession | null> {
    const raw = await this.redis.commandClient.eval(
      CONSUME,
      2,
      key(id),
      `${key(id)}:lock`,
      actorId,
      meetupId,
      revision,
      Date.now(),
    );
    return typeof raw === 'string'
      ? (JSON.parse(raw) as PreferenceDraftSession)
      : null;
  }
  async allowRequest(actorId: string): Promise<boolean> {
    const identity = createHash('sha256').update(actorId).digest('hex');
    const minute = Math.floor(Date.now() / 60_000);
    const day = Math.floor(Date.now() / 86_400_000);
    const minuteCount = Number(
      await this.redis.commandClient.eval(
        LIMIT,
        1,
        `preference-rate:v2:${identity}:${minute}`,
        60,
      ),
    );
    if (
      minuteCount >
      (this.config.get<number>('aiPreference.requestsPerMinute') ?? 6)
    )
      return false;
    const dailyCount = Number(
      await this.redis.commandClient.eval(
        LIMIT,
        1,
        `preference-day:v2:${identity}:${day}`,
        86_400,
      ),
    );
    return (
      dailyCount <=
      (this.config.get<number>('aiPreference.requestsPerDay') ?? 60)
    );
  }
}
