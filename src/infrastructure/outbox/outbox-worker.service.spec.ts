import { OutboxWorkerService } from './outbox-worker.service';

const event = {
  id: '7bfc82cb-a0fa-488c-9ed4-870e7393ba15',
  eventName: 'MeetupFinalized.v1' as const,
  destination: 'push' as const,
  recipientIds: ['4e0f9f54-6f06-453d-bc0c-4e63fe80cf13'],
  payload: {
    eventId: '7bfc82cb-a0fa-488c-9ed4-870e7393ba15',
    eventName: 'MeetupFinalized.v1',
    meetupId: 'a86c2e79-4453-4b5f-81ee-3532265b4a73',
    placeId: 'cd2ed2c4-0dc2-4d55-a6a2-5a23e6125670',
    scheduledAt: '2026-10-13T00:00:00.000Z',
    occurredAt: '2026-10-13T00:00:00.000Z',
  },
};

describe('OutboxWorkerService delivery', () => {
  let repository: { findOneBy: jest.Mock; update: jest.Mock };
  let dispatcher: { dispatch: jest.Mock };
  let worker: {
    deliver(eventId: string, attemptNumber: number): Promise<void>;
  };

  beforeEach(() => {
    repository = {
      findOneBy: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    dispatcher = { dispatch: jest.fn() };
    worker = Object.create(OutboxWorkerService.prototype) as typeof worker;
    Object.assign(worker, {
      dataSource: { getRepository: jest.fn(() => repository) },
      dispatcher,
    });
  });

  it('does not send a duplicate event that was already delivered', async () => {
    repository.findOneBy.mockResolvedValue({ ...event, status: 'delivered' });

    await worker.deliver(event.id, 2);

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('records a failed push attempt after the business transaction has committed', async () => {
    repository.findOneBy.mockResolvedValue({ ...event, status: 'pending' });
    dispatcher.dispatch.mockRejectedValue(
      new Error('Push notification delivery failed'),
    );

    await expect(worker.deliver(event.id, 1)).rejects.toThrow(
      'Push notification delivery failed',
    );

    expect(repository.update).toHaveBeenCalledWith(event.id, {
      status: 'pending',
      attemptCount: 1,
      lastError: 'Push notification delivery failed',
    });
  });

  it('does not repeat the RecommendationReady side effect after delivery is recorded', async () => {
    const ready = {
      ...event,
      id: '8bfc82cb-a0fa-488c-9ed4-870e7393ba16',
      eventName: 'RecommendationReady.v1' as const,
      destination: 'realtime' as const,
      recipientIds: [],
      payload: {
        eventId: '8bfc82cb-a0fa-488c-9ed4-870e7393ba16',
        eventName: 'RecommendationReady.v1' as const,
        occurredAt: '2026-11-02T00:00:00.000Z',
        meetupId: 'a86c2e79-4453-4b5f-81ee-3532265b4a73',
        runId: 'cd2ed2c4-0dc2-4d55-a6a2-5a23e6125670',
        placeIds: ['google-place-1'],
        strategy: 'exact' as const,
      },
    };
    repository.findOneBy.mockResolvedValueOnce({ ...ready, status: 'pending' });

    await worker.deliver(ready.id, 1);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(repository.update).toHaveBeenCalledWith(
      ready.id,
      expect.objectContaining({ status: 'delivered' }),
    );

    repository.findOneBy.mockResolvedValueOnce({
      ...ready,
      status: 'delivered',
    });
    await worker.deliver(ready.id, 2);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
  });
});
