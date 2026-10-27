import type {
  PlaceCandidate,
  PlaceSearchInput,
  PlaceSearchPort,
} from '../../application/ports/place-search.port';

/** Deterministic adapter for recommendation use-case tests. */
export class PlaceSearchAdapter implements PlaceSearchPort {
  constructor(private readonly candidates: PlaceCandidate[] = []) {}

  search(input: PlaceSearchInput): Promise<PlaceCandidate[]> {
    void input;
    return Promise.resolve([...this.candidates]);
  }

  searchPage(input: PlaceSearchInput) {
    void input;
    return Promise.resolve({ candidates: [...this.candidates] });
  }
}
