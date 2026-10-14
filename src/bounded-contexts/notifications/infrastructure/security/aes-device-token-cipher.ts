import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DeviceTokenCipherPort } from '../../application/ports/device-token-cipher.port';

const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

@Injectable()
export class AesDeviceTokenCipher implements DeviceTokenCipherPort {
  private readonly encryptionKey: Buffer;

  constructor(config: ConfigService) {
    this.encryptionKey = Buffer.from(
      config.getOrThrow<string>('deviceTokens.encryptionKey'),
      'base64',
    );
    if (this.encryptionKey.length !== 32) {
      throw new Error('DEVICE_TOKEN_ENCRYPTION_KEY must decode to 32 bytes');
    }
  }

  encrypt(token: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(token, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const payload = Buffer.from(ciphertext, 'base64');
    if (payload.length <= IV_BYTES + AUTH_TAG_BYTES) {
      throw new Error('Device token ciphertext is invalid');
    }
    const iv = payload.subarray(0, IV_BYTES);
    const authTag = payload.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
    const encrypted = payload.subarray(IV_BYTES + AUTH_TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }

  fingerprint(token: string): string {
    return createHmac('sha256', this.encryptionKey).update(token).digest('hex');
  }
}
