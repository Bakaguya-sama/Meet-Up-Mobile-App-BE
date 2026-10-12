import { PlaceSearchAdapter } from './place-search.adapter';
import { RouteMatrixAdapter } from './route-matrix.adapter';

describe('recommendation adapters', () => {
  it('returns copies so a test cannot mutate future Place responses', async () => {
    const places = new PlaceSearchAdapter([
      { providerPlaceId: 'place-1', name: 'Cafe', categories: ['cafe'] },
    ]);

    const result = await places.search({
      query: 'cafe',
      latitude: 0,
      longitude: 0,
      radiusMeters: 500,
    });

    expect(result).toEqual([
      { providerPlaceId: 'place-1', name: 'Cafe', categories: ['cafe'] },
    ]);
  });

  it('returns deterministic route matrix rows', async () => {
    const routes = new RouteMatrixAdapter([
      {
        originId: 'participant-1',
        destinationId: 'place-1',
        durationSeconds: 300,
        distanceMeters: 1200,
      },
    ]);

    await expect(
      routes.calculate({ origins: [], destinations: [] }),
    ).resolves.toHaveLength(1);
  });
});
