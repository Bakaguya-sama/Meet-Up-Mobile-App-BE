import { PlaceSearchAdapter } from './place-search.adapter';
import { RouteMatrixAdapter } from './route-matrix.adapter';

describe('recommendation adapters', () => {
  it('returns copies so a test cannot mutate future Place responses', async () => {
    const places = new PlaceSearchAdapter([
      {
        providerPlaceId: 'place-1',
        name: 'Cafe',
        categories: ['cafe'],
        latitude: 10.7,
        longitude: 106.7,
      },
    ]);

    const result = await places.search({
      query: 'cafe',
      latitude: 0,
      longitude: 0,
      radiusMeters: 500,
    });

    expect(result).toEqual([
      {
        providerPlaceId: 'place-1',
        name: 'Cafe',
        categories: ['cafe'],
        latitude: 10.7,
        longitude: 106.7,
      },
    ]);
  });

  it('returns deterministic route matrix rows', async () => {
    const routes = new RouteMatrixAdapter({
      features: [
        {
          participantId: 'participant-1',
          canonicalCandidateKey: 'place-1',
          etaSeconds: 300,
          distanceMeters: 1200,
          status: 'OK',
        },
      ],
      failures: [],
    });

    await expect(
      routes.calculateBatch({
        travelMode: 'TWO_WHEELER',
        origins: [
          { participantId: 'participant-1', latitude: 10, longitude: 106 },
        ],
        destinations: [
          {
            canonicalCandidateKey: 'place-1',
            latitude: 10,
            longitude: 106,
          },
        ],
      }),
    ).resolves.toMatchObject({ features: [{ etaSeconds: 300 }] });
  });
});
