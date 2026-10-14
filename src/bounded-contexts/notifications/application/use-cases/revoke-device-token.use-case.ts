import { DeviceTokenAccessError } from '../../domain/device-token-access.error';
import type { DeviceTokenStorePort } from '../ports/device-token-store.port';

export class RevokeDeviceTokenUseCase {
  constructor(private readonly store: DeviceTokenStorePort) {}

  async execute(userId: string, deviceTokenId: string): Promise<void> {
    const token = await this.store.findById(deviceTokenId);
    if (!token || token.userId !== userId) throw new DeviceTokenAccessError();
    if (!token.revokedAt) await this.store.revoke(token.id, new Date());
  }
}
