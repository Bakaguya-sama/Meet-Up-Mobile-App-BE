import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import type { LocationSample } from '../../domain/location-visibility';
import type { LocationPort } from '../../application/ports/location.port';

const LOCATION_TTL_SECONDS = 300;

@Injectable()
export class RedisLocationAdapter implements LocationPort {
  constructor(private readonly redis: RedisService) {}

  async save(ownerId: string, sample: LocationSample): Promise<void> {
    await this.redis.set(
      this.key(ownerId),
      JSON.stringify({
        latitude: sample.latitude,
        longitude: sample.longitude,
        accuracy: sample.accuracy,
        recordedAt: sample.recordedAt.toISOString(),
      }),
      LOCATION_TTL_SECONDS,
    );
  }

  async get(ownerId: string): Promise<LocationSample | null> {
    const value = await this.redis.get(this.key(ownerId));
    if (!value) return null;
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      if (
        typeof parsed.latitude !== 'number' ||
        typeof parsed.longitude !== 'number' ||
        typeof parsed.accuracy !== 'number' ||
        typeof parsed.recordedAt !== 'string'
      ) {
        await this.remove(ownerId);
        return null;
      }
      return {
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        accuracy: parsed.accuracy,
        recordedAt: new Date(parsed.recordedAt),
      };
    } catch {
      await this.remove(ownerId);
      return null;
    }
  }

  async remove(ownerId: string): Promise<void> {
    await this.redis.del(this.key(ownerId));
  }

  private key(ownerId: string): string {
    return `location:${ownerId.toLowerCase()}`;
  }
}
