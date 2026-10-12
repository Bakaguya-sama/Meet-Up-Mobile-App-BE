import type {
  PlaceCandidate,
  PlaceSearchPort,
} from '../../application/ports/place-search.port';

/** Deterministic adapter for recommendation use cases before Google Places is integrated. */
export class PlaceSearchAdapter implements PlaceSearchPort {
  constructor(private readonly candidates: PlaceCandidate[] = []) {}

  search(): Promise<PlaceCandidate[]> {
    return Promise.resolve([...this.candidates]);
  }
}
