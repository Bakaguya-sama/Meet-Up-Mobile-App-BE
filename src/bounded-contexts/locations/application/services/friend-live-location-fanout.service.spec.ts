import { FriendshipReader } from '../../../friends/application/public/friendship-reader';
import type { LocationPort } from '../ports/location.port';
import { LocationAccessService } from './location-access.service';
import {
  FriendLiveLocationFanoutService,
  type FriendLiveLocationThrottle,
} from './friend-live-location-fanout.service';
import type { RealtimePublisherPort } from '../../../../shared-kernel/application/realtime-publisher.port';

describe('FriendLiveLocationFanoutService', () => {
  const owner = 'aaaaaaaa-0000-4000-8000-000000000001';
  const allowed = 'bbbbbbbb-0000-4000-8000-000000000002';
  const denied = 'cccccccc-0000-4000-8000-000000000003';
  const sample = {
    latitude: 10.77,
    longitude: 106.69,
    accuracy: 8,
    recordedAt: new Date(),
  };

  it('fans out only projected locations to permitted friend user rooms', async () => {
    const friends = {
      acceptedFriendIds: jest.fn().mockResolvedValue([allowed, denied]),
    };
    const locations = { get: jest.fn().mockResolvedValue(sample) };
    const access = {
      projectFriendLiveLocation: jest.fn(
        async (_owner: string, viewer: string) => {
          if (viewer === denied) throw new Error('privacy denied');
          return {
            ...sample,
            isApproximate: true,
            latitude: 10.77,
            longitude: 106.69,
            accuracy: 1000,
          };
        },
      ),
    };
    const throttle = { shouldEmit: jest.fn().mockResolvedValue(true) };
    const realtime = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new FriendLiveLocationFanoutService(
      friends as unknown as FriendshipReader,
      locations as unknown as LocationPort,
      access as unknown as LocationAccessService,
      throttle,
      realtime,
    );

    await service.publish(owner);

    expect(realtime.publish).toHaveBeenCalledTimes(1);
    expect(realtime.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        room: `user:${allowed}`,
        eventName: 'friend:location:updated',
        payload: expect.objectContaining({ ownerId: owner }),
      }),
    );
  });

  it('does not fan out when the atomic throttle rejects the sample', async () => {
    const realtime = { publish: jest.fn() };
    const service = new FriendLiveLocationFanoutService(
      { acceptedFriendIds: jest.fn() } as unknown as FriendshipReader,
      { get: jest.fn().mockResolvedValue(sample) } as unknown as LocationPort,
      {} as LocationAccessService,
      { shouldEmit: jest.fn().mockResolvedValue(false) },
      realtime,
    );
    await service.publish(owner);
    expect(realtime.publish).not.toHaveBeenCalled();
  });

  it('publishes a separately projected payload to every permitted viewer and never leaks fields outside the projection', async () => {
    const first = 'dddddddd-0000-4000-8000-000000000004';
    const second = 'eeeeeeee-0000-4000-8000-000000000005';
    const realtime = { publish: jest.fn().mockResolvedValue(undefined) };
    const access = {
      projectFriendLiveLocation: jest.fn(async (_: string, viewer: string) => ({
        latitude: viewer === first ? 10.77 : 10.78,
        longitude: 106.69,
        accuracy: 1000,
        recordedAt: sample.recordedAt,
        isApproximate: true,
      })),
    };
    await new FriendLiveLocationFanoutService(
      {
        acceptedFriendIds: jest.fn().mockResolvedValue([first, second]),
      } as unknown as FriendshipReader,
      { get: jest.fn().mockResolvedValue(sample) } as unknown as LocationPort,
      access as unknown as LocationAccessService,
      { shouldEmit: jest.fn().mockResolvedValue(true) },
      realtime,
    ).publish(owner);

    expect(realtime.publish).toHaveBeenCalledTimes(2);
    for (const message of realtime.publish.mock.calls.map(([value]) => value)) {
      expect(message).toEqual(
        expect.objectContaining({ eventName: 'friend:location:updated' }),
      );
      expect(message.payload).toEqual({
        ownerId: owner,
        location: expect.objectContaining({ isApproximate: true }),
      });
      expect(JSON.stringify(message)).not.toContain('token');
      expect(JSON.stringify(message)).not.toContain('address');
    }
  });

  it('does not publish when latest location is absent or every per-viewer authorization check fails', async () => {
    const realtime = { publish: jest.fn().mockResolvedValue(undefined) };
    const missing = new FriendLiveLocationFanoutService(
      { acceptedFriendIds: jest.fn() } as unknown as FriendshipReader,
      { get: jest.fn().mockResolvedValue(null) } as unknown as LocationPort,
      {} as LocationAccessService,
      { shouldEmit: jest.fn() },
      realtime,
    );
    await missing.publish(owner);
    const deniedService = new FriendLiveLocationFanoutService(
      {
        acceptedFriendIds: jest.fn().mockResolvedValue([denied]),
      } as unknown as FriendshipReader,
      { get: jest.fn().mockResolvedValue(sample) } as unknown as LocationPort,
      {
        projectFriendLiveLocation: jest
          .fn()
          .mockRejectedValue(new Error('denied')),
      } as unknown as LocationAccessService,
      { shouldEmit: jest.fn().mockResolvedValue(true) },
      realtime,
    );
    await deniedService.publish(owner);
    expect(realtime.publish).not.toHaveBeenCalled();
  });
});
