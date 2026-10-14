import type { LocationSample } from '../../domain/location-visibility';

export const LOCATION_STORE = Symbol('LOCATION_STORE');

export interface LocationPort {
  save(
    ownerId: string,
    sample: LocationSample,
    meetupId?: string,
  ): Promise<void>;
  get(ownerId: string, meetupId?: string): Promise<LocationSample | null>;
  remove(ownerId: string, meetupId?: string): Promise<void>;
}
