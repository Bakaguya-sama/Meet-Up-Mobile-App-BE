import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import type {
  AiExplanationCache,
  AiExplanationValue,
} from '../../application/ports/ai-explanation.port';

@Injectable()
export class RedisAiExplanationCache implements AiExplanationCache {
  constructor(private readonly redis: RedisService) {}
  async get(key: string): Promise<AiExplanationValue | null> {
    const raw = await this.redis.get(`ai-explanation:${key}`);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as AiExplanationValue;
      return typeof value.text === 'string' && Array.isArray(value.factKeys)
        ? value
        : null;
    } catch {
      await this.remove(key);
      return null;
    }
  }
  set(key: string, value: AiExplanationValue, ttlSeconds: number) {
    return this.redis.set(
      `ai-explanation:${key}`,
      JSON.stringify(value),
      ttlSeconds,
    );
  }
  remove(key: string) {
    return this.redis.del(`ai-explanation:${key}`);
  }
}
