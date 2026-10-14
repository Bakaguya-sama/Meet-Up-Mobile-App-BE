import { RegisterDeviceTokenUseCase } from './register-device-token.use-case';
import { RevokeDeviceTokenUseCase } from './revoke-device-token.use-case';
import { UpdateDeviceTokenUseCase } from './update-device-token.use-case';
import { DeviceTokenAccessError } from '../../domain/device-token-access.error';

const userId = '4e0f9f54-6f06-453d-bc0c-4e63fe80cf13';
const otherUserId = 'a86c2e79-4453-4b5f-81ee-3532265b4a73';
const deviceId = '6c0d662b-6b77-489e-88e5-e574334f8c6b';
const request = {
  token: 'fcm-token-abcdefghijklmnopqrstuvwxyz',
  platform: 'android',
} as const;

describe('Device token use cases', () => {
  let store: {
    findById: jest.Mock;
    findByFingerprint: jest.Mock;
    listActiveForUser: jest.Mock;
    save: jest.Mock;
    revoke: jest.Mock;
  };
  const cipher = {
    encrypt: jest.fn(() => 'ciphertext'),
    decrypt: jest.fn(),
    fingerprint: jest.fn(() => 'a'.repeat(64)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    store = {
      findById: jest.fn(),
      findByFingerprint: jest.fn(),
      listActiveForUser: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      revoke: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('reassigns a duplicate token to the current user without returning the token', async () => {
    store.findByFingerprint.mockResolvedValue({
      id: deviceId,
      userId: otherUserId,
      tokenCiphertext: 'old',
      tokenFingerprint: 'a'.repeat(64),
      platform: 'ios',
      revokedAt: new Date(),
    });
    const useCase = new RegisterDeviceTokenUseCase(store, cipher);

    await expect(useCase.execute(userId, request)).resolves.toEqual({
      id: deviceId,
    });
    expect(store.save).toHaveBeenCalledWith({
      id: deviceId,
      userId,
      tokenCiphertext: 'ciphertext',
      tokenFingerprint: 'a'.repeat(64),
      platform: 'android',
      revokedAt: null,
    });
  });

  it('rejects an update for a token owned by another user', async () => {
    store.findById.mockResolvedValue({ id: deviceId, userId: otherUserId });
    const useCase = new UpdateDeviceTokenUseCase(store, cipher);

    await expect(
      useCase.execute(userId, deviceId, request),
    ).rejects.toBeInstanceOf(DeviceTokenAccessError);
  });

  it('revokes an active token owned by the caller', async () => {
    store.findById.mockResolvedValue({ id: deviceId, userId, revokedAt: null });
    const useCase = new RevokeDeviceTokenUseCase(store);

    await useCase.execute(userId, deviceId);

    expect(store.revoke).toHaveBeenCalledWith(deviceId, expect.any(Date));
  });
});
