import type { RouteMatrixPort } from '../../application/ports/route-matrix.port';

/** Deterministic adapter for ETA/ranking tests before Google Routes is integrated. */
export class RouteMatrixAdapter implements RouteMatrixPort {
  constructor(
    private readonly routes: Array<{
      originId: string;
      destinationId: string;
      durationSeconds: number;
      distanceMeters: number;
    }> = [],
  ) {}

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
  > {
    void input;
    return Promise.resolve([...this.routes]);
  }
}
