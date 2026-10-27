import type {
  PlaceSearchInput,
  PlaceSearchPort,
} from '../ports/place-search.port';
import { RECOMMENDATION_CONFIG_DEV_V1 } from '../recommendation-config';
import { CandidateGenerator } from './candidate-generator';

class ScriptedPlaceBoundary implements PlaceSearchPort {
  readonly calls: PlaceSearchInput[] = [];

  constructor(
    private readonly pages: Array<
      | {
          candidates: Array<{
            providerPlaceId: string;
            name: string;
            categories: string[];
            latitude: number;
            longitude: number;
          }>;
          nextPageToken?: string;
        }
      | Error
    >,
  ) {}

  async search(input: PlaceSearchInput) {
    return (await this.searchPage(input)).candidates;
  }

  searchPage(input: PlaceSearchInput) {
    this.calls.push(input);
    const page = this.pages.shift() ?? { candidates: [] };
    return page instanceof Error ? Promise.reject(page) : Promise.resolve(page);
  }
}

const candidate = (id: string, categories: string[]) => ({
  providerPlaceId: id,
  name: id,
  categories,
  latitude: 10.7,
  longitude: 106.7,
});

describe('CandidateGenerator pagination', () => {
  it('retrieves deterministic round-robin pages with page tokens and openNow', async () => {
    const boundary = new ScriptedPlaceBoundary([
      { candidates: [candidate('bar-1', ['bar'])], nextPageToken: 'bar-2' },
      { candidates: [candidate('cafe-1', ['cafe'])], nextPageToken: 'cafe-2' },
      { candidates: [candidate('bar-2', ['bar'])] },
      { candidates: [candidate('cafe-2', ['cafe'])] },
    ]);
    const generator = new CandidateGenerator(boundary, {
      ...RECOMMENDATION_CONFIG_DEV_V1,
      candidateTargetCount: 10,
      providerCallBudget: 4,
    });

    const result = await generator.generate({
      categories: ['cafe', 'bar'],
      openingFilter: 'OPEN_AT_REQUEST_TIME',
      center: { latitude: 10.7, longitude: 106.7 },
      radiusMeters: 1000,
    });

    expect(
      result.map((item) => `${item.sourceCategory}:${item.sourcePage}`),
    ).toEqual(['bar:1', 'cafe:1', 'bar:2', 'cafe:2']);
    expect(boundary.calls.map((call) => call.pageToken ?? null)).toEqual([
      null,
      null,
      'bar-2',
      'cafe-2',
    ]);
    expect(boundary.calls.every((call) => call.openNow === true)).toBe(true);
  });

  it('returns an empty final page without extra calls', async () => {
    const boundary = new ScriptedPlaceBoundary([{ candidates: [] }]);
    const generator = new CandidateGenerator(
      boundary,
      RECOMMENDATION_CONFIG_DEV_V1,
    );
    await expect(
      generator.generate({
        categories: ['cafe'],
        openingFilter: 'ANY',
        center: { latitude: 10.7, longitude: 106.7 },
        radiusMeters: 1000,
      }),
    ).resolves.toEqual([]);
    expect(boundary.calls).toHaveLength(1);
    expect(boundary.calls[0]).not.toHaveProperty('openNow');
  });

  it('propagates a provider error from a later page', async () => {
    const boundary = new ScriptedPlaceBoundary([
      { candidates: [candidate('cafe-1', ['cafe'])], nextPageToken: 'next' },
      new Error('HTTP boundary failed'),
    ]);
    const generator = new CandidateGenerator(boundary, {
      ...RECOMMENDATION_CONFIG_DEV_V1,
      candidateTargetCount: 10,
    });
    await expect(
      generator.generate({
        categories: ['cafe'],
        openingFilter: 'ANY',
        center: { latitude: 10.7, longitude: 106.7 },
        radiusMeters: 1000,
      }),
    ).rejects.toThrow('HTTP boundary failed');
  });
});
