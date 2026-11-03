import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../../infrastructure/redis/redis.service';
import type {
  FriendQrSession,
  FriendQrSessionStorePort,
} from '../../../application/ports/persistence/friend-qr-session-store.port';

const CREATE_SESSION = `
  if redis.call('EXISTS', KEYS[1]) == 1 or redis.call('EXISTS', KEYS[2]) == 1 then
    return 0
  end
  redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
  redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
  return 1
`;

const REVOKE_SESSION = `
  local tokenHash = redis.call('GET', KEYS[1])
  if not tokenHash then return 0 end
  local tokenKey = ARGV[3] .. tokenHash
  local serialized = redis.call('GET', tokenKey)
  if not serialized then
    redis.call('DEL', KEYS[1])
    return 0
  end
  local session = cjson.decode(serialized)
  if session.ownerId ~= ARGV[1] or session.sessionId ~= ARGV[2] then
    return -1
  end
  redis.call('DEL', tokenKey, KEYS[1])
  return 1
`;

@Injectable()
export class RedisFriendQrSessionStore implements FriendQrSessionStorePort {
  constructor(private readonly redis: RedisService) {}

  async create(input: {
    tokenHash: string;
    sessionId: string;
    ownerId: string;
    ttlSeconds: number;
  }): Promise<boolean> {
    const result = Number(
      await this.redis.commandClient.eval(
        CREATE_SESSION,
        2,
        tokenKey(input.tokenHash),
        sessionKey(input.sessionId),
        JSON.stringify({ ownerId: input.ownerId, sessionId: input.sessionId }),
        input.tokenHash,
        input.ttlSeconds,
      ),
    );
    return result === 1;
  }

  async resolve(tokenHash: string): Promise<FriendQrSession | null> {
    const serialized = await this.redis.get(tokenKey(tokenHash));
    if (!serialized) return null;
    try {
      const value: unknown = JSON.parse(serialized);
      if (
        !value ||
        typeof value !== 'object' ||
        !('ownerId' in value) ||
        !('sessionId' in value) ||
        typeof value.ownerId !== 'string' ||
        typeof value.sessionId !== 'string'
      ) {
        return null;
      }
      return { ownerId: value.ownerId, sessionId: value.sessionId };
    } catch {
      return null;
    }
  }

  async revoke(ownerId: string, sessionId: string): Promise<boolean> {
    const result = Number(
      await this.redis.commandClient.eval(
        REVOKE_SESSION,
        1,
        sessionKey(sessionId),
        ownerId,
        sessionId,
        'friend-qr:v1:token:',
      ),
    );
    return result === 1;
  }
}

function tokenKey(tokenHash: string): string {
  if (!/^[a-f0-9]{64}$/.test(tokenHash)) {
    throw new Error('Friend QR token key must be a SHA-256 hash');
  }
  return `friend-qr:v1:token:${tokenHash}`;
}

function sessionKey(sessionId: string): string {
  return `friend-qr:v1:session:${sessionId}`;
}
