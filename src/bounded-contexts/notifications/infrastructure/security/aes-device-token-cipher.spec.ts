import { AesDeviceTokenCipher } from './aes-device-token-cipher';

describe('AesDeviceTokenCipher', () => {
  const key = Buffer.alloc(32, 7).toString('base64');

  it('encrypts non-deterministically and decrypts the original token', () => {
    const cipher = new AesDeviceTokenCipher({
      getOrThrow: jest.fn(() => key),
    } as never);

    const first = cipher.encrypt('fcm-token-abcdefghijklmnopqrstuvwxyz');
    const second = cipher.encrypt('fcm-token-abcdefghijklmnopqrstuvwxyz');

    expect(first).not.toBe(second);
    expect(cipher.decrypt(first)).toBe('fcm-token-abcdefghijklmnopqrstuvwxyz');
    expect(
      cipher.fingerprint('fcm-token-abcdefghijklmnopqrstuvwxyz'),
    ).toHaveLength(64);
  });
});
