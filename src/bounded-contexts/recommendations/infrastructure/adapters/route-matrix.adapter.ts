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

  calculate(): Promise<
    Array<{
      originId: string;
      destinationId: string;
      durationSeconds: number;
      distanceMeters: number;
    }>
  > {
    return Promise.resolve([...this.routes]);
  }
}
