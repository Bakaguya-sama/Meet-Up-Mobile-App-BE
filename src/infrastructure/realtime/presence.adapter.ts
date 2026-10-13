import { Injectable } from '@nestjs/common';
import type { PresencePort } from '../../shared-kernel/application/presence.port';
import { RedisService } from '../redis/redis.service';

const PRESENCE_TTL_SECONDS = 60;

@Injectable()
export class PresenceAdapter implements PresencePort {
  constructor(private readonly redis: RedisService) {}

  async connect(userId: string, connectionId: string): Promise<void> {
    const key = this.key(userId);
    await this.redis.commandClient
      .multi()
      .sadd(key, connectionId)
      .expire(key, PRESENCE_TTL_SECONDS)
      .exec();
  }

  async refresh(userId: string, connectionId: string): Promise<void> {
    const key = this.key(userId);
    const isKnownConnection = await this.redis.commandClient.sismember(
      key,
      connectionId,
    );
    if (isKnownConnection) {
      await this.redis.commandClient.expire(key, PRESENCE_TTL_SECONDS);
    }
  }

  async disconnect(userId: string, connectionId: string): Promise<void> {
    const key = this.key(userId);
    const removedConnectionCount = await this.redis.commandClient.srem(
      key,
      connectionId,
    );
    if (removedConnectionCount === 1) {
      const count = await this.redis.commandClient.scard(key);
      if (count === 0) await this.redis.del(key);
    }
  }

  async isOnline(userId: string): Promise<boolean> {
    return (await this.redis.commandClient.scard(this.key(userId))) > 0;
  }

  private key(userId: string): string {
    return `presence:${userId.toLowerCase()}`;
  }
}
