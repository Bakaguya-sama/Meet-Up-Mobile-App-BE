import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }

  get commandClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async setIfAbsent(
    key: string,
    value: string,
    ttlMilliseconds: number,
  ): Promise<boolean> {
    const result = await this.client.set(
      key,
      value,
      'PX',
      ttlMilliseconds,
      'NX',
    );
    return result === 'OK';
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
