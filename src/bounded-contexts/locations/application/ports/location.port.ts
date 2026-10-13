import type { LocationSample } from '../../domain/location-visibility';

export const LOCATION_STORE = Symbol('LOCATION_STORE');

export interface LocationPort {
  save(ownerId: string, sample: LocationSample): Promise<void>;
  get(ownerId: string): Promise<LocationSample | null>;
  remove(ownerId: string): Promise<void>;
}
