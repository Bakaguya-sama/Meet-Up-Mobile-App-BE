import { RealtimePublisherAdapter } from './realtime-publisher.adapter';

describe('RealtimePublisherAdapter', () => {
  it('fails instead of losing an event before the gateway is ready', async () => {
    const publisher = new RealtimePublisherAdapter();
    await expect(
      publisher.publish({
        room: 'user:1',
        eventName: 'MeetupCreated.v1',
        eventId: 'event-1',
        payload: {},
      }),
    ).rejects.toThrow('not ready');
  });

  it('emits to the requested Socket.IO room after the gateway binds', async () => {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const publisher = new RealtimePublisherAdapter();
    publisher.bindServer({ to } as never);
    const payload = { eventId: 'event-1' };
    await publisher.publish({
      room: 'user:1',
      eventName: 'MeetupCreated.v1',
      eventId: 'event-1',
      payload,
    });
    expect(to).toHaveBeenCalledWith('user:1');
    expect(emit).toHaveBeenCalledWith('MeetupCreated.v1', payload);
  });
});
