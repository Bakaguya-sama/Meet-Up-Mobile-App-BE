export const DEVICE_TOKEN_STORE = Symbol('DEVICE_TOKEN_STORE');

export type StoredDeviceToken = {
  id: string;
  userId: string;
  tokenCiphertext: string;
  tokenFingerprint: string;
  platform: 'android' | 'ios';
  revokedAt: Date | null;
};

export interface DeviceTokenStorePort {
  findById(id: string): Promise<StoredDeviceToken | null>;
  findByFingerprint(fingerprint: string): Promise<StoredDeviceToken | null>;
  listActiveForUser(userId: string): Promise<StoredDeviceToken[]>;
  save(token: StoredDeviceToken): Promise<void>;
  revoke(id: string, revokedAt: Date): Promise<void>;
}
