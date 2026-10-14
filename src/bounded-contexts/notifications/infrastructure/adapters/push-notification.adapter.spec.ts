import { PushNotificationAdapter } from './push-notification.adapter';

describe('PushNotificationAdapter', () => {
  const recipientId = '4e0f9f54-6f06-453d-bc0c-4e63fe80cf13';

  it('sends only the deep-link data contract and revokes an invalid FCM token', async () => {
    const tokens = {
      listActiveForUser: jest.fn().mockResolvedValue([
        {
          id: '6c0d662b-6b77-489e-88e5-e574334f8c6b',
          tokenCiphertext: 'encrypted',
        },
      ]),
      revoke: jest.fn().mockResolvedValue(undefined),
    };
    const cipher = {
      decrypt: jest.fn(() => 'fcm-token-abcdefghijklmnopqrstuvwxyz'),
    };
    const fcm = {
      send: jest.fn().mockRejectedValue({
        code: 'messaging/registration-token-not-registered',
      }),
    };
    const adapter = new PushNotificationAdapter(
      tokens as never,
      cipher as never,
      fcm,
    );

    await expect(
      adapter.send({
        recipientId,
        eventId: '7bfc82cb-a0fa-488c-9ed4-870e7393ba15',
        title: 'Meetup finalized',
        body: 'A place has been finalized.',
        data: {
          type: 'meetup.finalized',
          meetupId: 'a86c2e79-4453-4b5f-81ee-3532265b4a73',
          placeId: 'cd2ed2c4-0dc2-4d55-a6a2-5a23e6125670',
        },
      }),
    ).resolves.toBeUndefined();

    expect(fcm.send).toHaveBeenCalledWith({
      token: 'fcm-token-abcdefghijklmnopqrstuvwxyz',
      title: 'Meetup finalized',
      body: 'A place has been finalized.',
      data: {
        type: 'meetup.finalized',
        meetupId: 'a86c2e79-4453-4b5f-81ee-3532265b4a73',
        placeId: 'cd2ed2c4-0dc2-4d55-a6a2-5a23e6125670',
      },
    });
    expect(tokens.revoke).toHaveBeenCalledWith(
      '6c0d662b-6b77-489e-88e5-e574334f8c6b',
      expect.any(Date),
    );
  });

  it('raises a generic failure for retry without exposing an FCM error', async () => {
    const tokens = {
      listActiveForUser: jest.fn().mockResolvedValue([
        {
          id: '6c0d662b-6b77-489e-88e5-e574334f8c6b',
          tokenCiphertext: 'encrypted',
        },
      ]),
      revoke: jest.fn(),
    };
    const adapter = new PushNotificationAdapter(
      tokens as never,
      {
        decrypt: jest.fn(() => 'fcm-token-abcdefghijklmnopqrstuvwxyz'),
      } as never,
      { send: jest.fn().mockRejectedValue(new Error('provider details')) },
    );

    await expect(
      adapter.send({
        recipientId,
        eventId: '7bfc82cb-a0fa-488c-9ed4-870e7393ba15',
        title: 'Title',
        body: 'Body',
        data: {
          type: 'meetup.finalized',
          meetupId: 'a86c2e79-4453-4b5f-81ee-3532265b4a73',
        },
      }),
    ).rejects.toThrow('Push notification delivery failed');
  });
});
