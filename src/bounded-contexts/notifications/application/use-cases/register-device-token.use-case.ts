import { randomUUID } from 'node:crypto';
import type { DeviceTokenCipherPort } from '../ports/device-token-cipher.port';
import type {
  DeviceTokenStorePort,
  StoredDeviceToken,
} from '../ports/device-token-store.port';
import type { RegisterDeviceTokenRequest } from '../dto/device-token.dto';

export class RegisterDeviceTokenUseCase {
  constructor(
    private readonly store: DeviceTokenStorePort,
    private readonly cipher: DeviceTokenCipherPort,
  ) {}

  async execute(userId: string, input: RegisterDeviceTokenRequest) {
    const fingerprint = this.cipher.fingerprint(input.token);
    const existing = await this.store.findByFingerprint(fingerprint);
    const token: StoredDeviceToken = {
      id: existing?.id ?? randomUUID(),
      userId,
      tokenCiphertext: this.cipher.encrypt(input.token),
      tokenFingerprint: fingerprint,
      platform: input.platform,
      revokedAt: null,
    };
    await this.store.save(token);
    return { id: token.id };
  }
}
