import { OutboxDispatcher } from './outbox-dispatcher.service';

describe('OutboxDispatcher nearby notification', () => {
  it('fans out only the privacy-safe deep-link payload at the push boundary', async () => {
    const realtime = { publish: jest.fn() };
    const push = { send: jest.fn().mockResolvedValue(undefined) };
    const dispatcher = new OutboxDispatcher(realtime, push);
    await dispatcher.dispatch(
      {
        eventId: '11111111-1111-4111-8111-111111111111',
        eventName: 'NearbyFriendDetected.v1',
        occurredAt: '2026-11-15T00:00:00.000Z',
        friendId: '22222222-2222-4222-8222-222222222222',
      },
      'push',
      ['33333333-3333-4333-8333-333333333333'],
    );
    expect(push.send).toHaveBeenCalledWith({
      recipientId: '33333333-3333-4333-8333-333333333333',
      eventId: '11111111-1111-4111-8111-111111111111',
      title: 'Friend nearby',
      body: 'A friend is nearby. You can create a new meetup.',
      data: {
        type: 'nearby.friend',
        friendId: '22222222-2222-4222-8222-222222222222',
      },
    });
    expect(realtime.publish).not.toHaveBeenCalled();
    expect(JSON.stringify(push.send.mock.calls)).not.toMatch(
      /latitude|longitude|distance|address|token/i,
    );
  });
});
