import { DeviceTokenAccessError } from '../../domain/device-token-access.error';
import type { RegisterDeviceTokenRequest } from '../dto/device-token.dto';
import type { DeviceTokenCipherPort } from '../ports/device-token-cipher.port';
import type {
  DeviceTokenStorePort,
  StoredDeviceToken,
} from '../ports/device-token-store.port';

export class UpdateDeviceTokenUseCase {
  constructor(
    private readonly store: DeviceTokenStorePort,
    private readonly cipher: DeviceTokenCipherPort,
  ) {}

  async execute(
    userId: string,
    deviceTokenId: string,
    input: RegisterDeviceTokenRequest,
  ): Promise<{ id: string }> {
    const current = await this.store.findById(deviceTokenId);
    if (!current || current.userId !== userId)
      throw new DeviceTokenAccessError();

    const fingerprint = this.cipher.fingerprint(input.token);
    const duplicate = await this.store.findByFingerprint(fingerprint);
    if (duplicate && duplicate.id !== current.id) {
      await this.store.revoke(current.id, new Date());
      await this.store.save({
        ...duplicate,
        userId,
        tokenCiphertext: this.cipher.encrypt(input.token),
        platform: input.platform,
        revokedAt: null,
      });
      return { id: duplicate.id };
    }

    const updated: StoredDeviceToken = {
      ...current,
      tokenCiphertext: this.cipher.encrypt(input.token),
      tokenFingerprint: fingerprint,
      platform: input.platform,
      revokedAt: null,
    };
    await this.store.save(updated);
    return { id: updated.id };
  }
}
