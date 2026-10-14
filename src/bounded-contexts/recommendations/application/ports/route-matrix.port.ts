export const ROUTE_MATRIX = Symbol('ROUTE_MATRIX');

export interface RouteMatrixPort {
  calculate(input: {
    origins: Array<{ id: string; latitude: number; longitude: number }>;
    destinations: Array<{ id: string; latitude: number; longitude: number }>;
  }): Promise<
    Array<{
      originId: string;
      destinationId: string;
      durationSeconds: number;
      distanceMeters: number;
    }>
  >;
}
