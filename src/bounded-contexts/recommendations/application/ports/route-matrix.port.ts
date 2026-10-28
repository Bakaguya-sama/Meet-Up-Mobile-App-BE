export const ROUTE_MATRIX = Symbol('ROUTE_MATRIX');

export interface RouteOrigin {
  participantId: string;
  latitude: number;
  longitude: number;
}

export interface RouteDestination {
  canonicalCandidateKey: string;
  latitude: number;
  longitude: number;
}

export interface RouteBatchRequest {
  origins: RouteOrigin[];
  destinations: RouteDestination[];
  travelMode: 'TWO_WHEELER';
}

export interface RouteFeature {
  participantId: string;
  canonicalCandidateKey: string;
  etaSeconds: number;
  distanceMeters: number;
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
