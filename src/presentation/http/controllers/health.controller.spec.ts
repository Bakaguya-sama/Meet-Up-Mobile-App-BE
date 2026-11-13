import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController readiness', () => {
  it('reports ready only after PostgreSQL, Redis and outbox worker are ready', async () => {
    const controller = new HealthController(
      { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as never,
      { commandClient: { ping: jest.fn().mockResolvedValue('PONG') } } as never,
      { isReady: jest.fn().mockReturnValue(true) } as never,
    );

    await expect(controller.ready()).resolves.toEqual({
      status: 'ready',
      dependencies: { postgres: 'up', redis: 'up', outboxWorker: 'up' },
    });
  });

  it('returns a redacted 503 when an internal dependency is unavailable', async () => {
    const controller = new HealthController(
      {
        query: jest.fn().mockRejectedValue(new Error('postgresql://secret')),
      } as never,
      { commandClient: { ping: jest.fn().mockResolvedValue('PONG') } } as never,
      { isReady: jest.fn().mockReturnValue(true) } as never,
    );

    await expect(controller.ready()).rejects.toEqual(
      new ServiceUnavailableException({ status: 'not_ready' }),
    );
  });
});
