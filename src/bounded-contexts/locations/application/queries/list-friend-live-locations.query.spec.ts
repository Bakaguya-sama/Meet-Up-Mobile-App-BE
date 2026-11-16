import { FriendshipReader } from '../../../friends/application/public/friendship-reader';
import type { LocationPort } from '../ports/location.port';
import { LocationAccessService } from '../services/location-access.service';
import { ListFriendLiveLocationsQuery } from './list-friend-live-locations.query';

describe('ListFriendLiveLocationsQuery', () => {
  it('returns only unexpired locations projected for the requesting friend', async () => {
    const query = new ListFriendLiveLocationsQuery(
      {
        acceptedFriendIds: jest.fn().mockResolvedValue(['allowed', 'denied']),
      } as unknown as FriendshipReader,
      {
        get: jest.fn((id: string) =>
          Promise.resolve(
            id === 'allowed'
              ? {
                  latitude: 1,
                  longitude: 2,
                  accuracy: 10,
                  recordedAt: new Date(),
                }
              : null,
          ),
        ),
      } as unknown as LocationPort,
      {
        projectFriendLiveLocation: jest.fn().mockResolvedValue({
          latitude: 1,
          longitude: 2,
          accuracy: 1000,
          recordedAt: new Date(),
          isApproximate: true,
        }),
      } as unknown as LocationAccessService,
    );
    await expect(query.execute('viewer')).resolves.toMatchObject({
      items: [{ ownerId: 'allowed', location: { isApproximate: true } }],
    });
  });
});
