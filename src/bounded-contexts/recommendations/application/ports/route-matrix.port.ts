export const ROUTE_MATRIX = Symbol('ROUTE_MATRIX');

export type TravelMode = 'TWO_WHEELER' | 'DRIVE';
export type RoutingPreference = 'TRAFFIC_UNAWARE' | 'TRAFFIC_AWARE';

export interface RouteOrigin {
  participantId: string;
  latitude: number;
  longitude: number;
  /** Until Q20 is approved, production contexts intentionally omit this. */
  travelMode?: TravelMode;
}

export interface RouteDestination {
  canonicalCandidateKey: string;
  latitude: number;
  longitude: number;
}

export interface RouteBatchRequest {
  origins: RouteOrigin[];
  destinations: RouteDestination[];
  travelMode: TravelMode;
  routingPreference: RoutingPreference;
}

export interface RouteFeature {
  participantId: string;
  canonicalCandidateKey: string;
  etaSeconds: number;
  distanceMeters: number;
  /** Provider metric only; utility is always computed from etaSeconds/duration. */
  staticDurationSeconds?: number;
  status: 'OK';
}

export interface RouteFailure {
  participantId: string;
  canonicalCandidateKey: string;
  status: 'NO_ROUTE';
  providerCode?: string;
}

export interface RouteBatchResult {
  features: RouteFeature[];
  failures: RouteFailure[];
}

export interface RouteMatrixPort {
  calculateBatch(input: RouteBatchRequest): Promise<RouteBatchResult>;
}
