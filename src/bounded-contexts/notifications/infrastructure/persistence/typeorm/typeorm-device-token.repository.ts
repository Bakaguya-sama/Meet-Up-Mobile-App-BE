import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type {
  DeviceTokenStorePort,
  StoredDeviceToken,
} from '../../../application/ports/device-token-store.port';
import { DeviceTokenEntity } from './entities/device-token.typeorm-entity';

@Injectable()
export class TypeOrmDeviceTokenRepository implements DeviceTokenStorePort {
  constructor(
    @InjectRepository(DeviceTokenEntity)
    private readonly tokens: Repository<DeviceTokenEntity>,
  ) {}

  async findById(id: string): Promise<StoredDeviceToken | null> {
    const token = await this.tokens.findOneBy({ id });
    return token ? toStored(token) : null;
  }

  async findByFingerprint(
    tokenFingerprint: string,
  ): Promise<StoredDeviceToken | null> {
    const token = await this.tokens.findOneBy({ tokenFingerprint });
    return token ? toStored(token) : null;
  }

  async listActiveForUser(userId: string): Promise<StoredDeviceToken[]> {
    const tokens = await this.tokens.find({
      where: { userId, revokedAt: IsNull() },
    });
    return tokens.map(toStored);
  }

  async save(token: StoredDeviceToken): Promise<void> {
    const existing = await this.tokens.findOneBy({ id: token.id });
    await this.tokens.save({
      id: token.id,
      userId: token.userId,
      tokenCiphertext: token.tokenCiphertext,
      tokenFingerprint: token.tokenFingerprint,
      platform: token.platform,
      revokedAt: token.revokedAt,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    });
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await this.tokens.update(id, { revokedAt, updatedAt: new Date() });
  }
}

function toStored(entity: DeviceTokenEntity): StoredDeviceToken {
  return {
    id: entity.id,
    userId: entity.userId,
    tokenCiphertext: entity.tokenCiphertext,
    tokenFingerprint: entity.tokenFingerprint,
    platform: entity.platform,
    revokedAt: entity.revokedAt,
  };
}
