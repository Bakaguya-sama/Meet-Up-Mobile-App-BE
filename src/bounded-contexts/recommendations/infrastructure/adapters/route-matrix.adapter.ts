import type {
  RouteBatchRequest,
  RouteBatchResult,
  RouteMatrixPort,
} from '../../application/ports/route-matrix.port';

/** Deterministic external-boundary fake used only by unit tests. */
export class RouteMatrixAdapter implements RouteMatrixPort {
  constructor(private readonly result: RouteBatchResult) {}

  calculateBatch(input: RouteBatchRequest): Promise<RouteBatchResult> {
    void input;
    return Promise.resolve({
      features: this.result.features.map((feature) => ({ ...feature })),
      failures: this.result.failures.map((failure) => ({ ...failure })),
    });
  }
}
