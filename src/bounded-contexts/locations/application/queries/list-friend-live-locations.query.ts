import type { FriendshipReader } from '../../../friends/application/public/friendship-reader';
import type { LocationPort } from '../ports/location.port';
import { LocationAccessService } from '../services/location-access.service';

export class ListFriendLiveLocationsQuery {
  constructor(
    private readonly friends: FriendshipReader,
    private readonly locations: LocationPort,
    private readonly access: LocationAccessService,
  ) {}

  async execute(viewerId: string) {
    const items = await Promise.all(
      (await this.friends.acceptedFriendIds(viewerId)).map(async (ownerId) => {
        const sample = await this.locations.get(ownerId);
        if (!sample) return null;
        try {
          return {
            ownerId,
            location: await this.access.projectFriendLiveLocation(
              ownerId,
              viewerId,
              sample,
            ),
          };
        } catch {
          return null;
        }
      }),
    );
    return { items: items.filter((item) => item !== null) };
  }
}
