import type { LocationPort } from '../ports/location.port';
import type { ReadLocationAccess } from '../services/location-access.service';
import { LocationAccessService } from '../services/location-access.service';

export class GetLatestLocationQuery {
  constructor(
    private readonly access: LocationAccessService,
    private readonly locations: LocationPort,
  ) {}

  async execute(input: ReadLocationAccess) {
    const sample = await this.locations.get(
      input.ownerId,
      input.scope === 'meetup' ? input.meetupId : undefined,
    );
    if (!sample) return null;
    return this.access.projectForViewer(input, sample);
  }
}
