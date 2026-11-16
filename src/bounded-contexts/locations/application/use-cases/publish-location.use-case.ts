import {
  type LocationSample,
  validateLocationSample,
} from '../../domain/location-visibility';
import type { LocationPort } from '../ports/location.port';
import { LocationAccessService } from '../services/location-access.service';
import type { NearbyDetector } from '../../../nearby/application/nearby-detector';
import type { FriendLiveLocationFanoutService } from '../services/friend-live-location-fanout.service';

export interface PublishLocationInput {
  ownerId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  recordedAt: string;
  meetupId?: string;
}

export interface PublishLocationResult {
  accepted: true;
  expiresInSeconds: 300;
}

/**
 * Shared by the temporary HTTP endpoint and the BE-06 Socket handler.
 * Exact coordinates stop at the Redis adapter and are never sent to outbox/logs.
 */
export class PublishLocationUseCase {
  constructor(
    private readonly access: LocationAccessService,
    private readonly locations: LocationPort,
    private readonly nearby?: NearbyDetector,
    private readonly friendLiveFanout?: FriendLiveLocationFanoutService,
  ) {}

  async execute(input: PublishLocationInput): Promise<PublishLocationResult> {
    const sample: LocationSample = {
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      recordedAt: new Date(input.recordedAt),
    };

    validateLocationSample(sample, new Date());
    await this.access.requirePublish(input.ownerId, input.meetupId);
    await this.locations.save(input.ownerId, sample, input.meetupId);
    if (!input.meetupId) {
      if (this.nearby) await this.nearby.detect(input.ownerId);
      if (this.friendLiveFanout)
        await this.friendLiveFanout.publish(input.ownerId);
    }

    return { accepted: true, expiresInSeconds: 300 };
  }
}
