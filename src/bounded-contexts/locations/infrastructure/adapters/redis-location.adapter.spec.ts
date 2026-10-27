import { RedisLocationAdapter } from './redis-location.adapter';

describe('RedisLocationAdapter', () => {
  it('stores only the latest sample under the canonical key with a five-minute TTL', async () => {
    const redis = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      del: jest.fn(),
    };
    const adapter = new RedisLocationAdapter(redis as never);

    await adapter.save('OWNER-ID', {
      latitude: 10.776923,
      longitude: 106.700947,
      accuracy: 12,
      recordedAt: new Date('2026-10-27T00:00:00.000Z'),
    });

    expect(redis.set).toHaveBeenCalledWith(
      'location:owner-id',
      expect.stringContaining('10.776923'),
      300,
    );
  });
});
