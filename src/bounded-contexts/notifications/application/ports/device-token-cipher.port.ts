export const DEVICE_TOKEN_CIPHER = Symbol('DEVICE_TOKEN_CIPHER');

export interface DeviceTokenCipherPort {
  encrypt(token: string): string;
  decrypt(ciphertext: string): string;
  fingerprint(token: string): string;
}
