import { GooglePlacesAdapter, type PlacesFetch } from './google-places.adapter';

describe('GooglePlacesAdapter', () => {
  it('requests only candidate fields and normalizes the Places response', async () => {
    const request: jest.MockedFunction<PlacesFetch> = jest.fn();
    request.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          places: [
            {
              id: 'places/abc',
              displayName: { text: 'Cafe Example' },
              types: ['cafe', 'food'],
              location: { latitude: 10.77, longitude: 106.69 },
              formattedAddress: 'District 1',
              rating: 4.5,
              currentOpeningHours: { openNow: true },
            },
            { id: 'incomplete' },
          ],
        }),
    });
    const adapter = new GooglePlacesAdapter('test-key', request);

    await expect(
      adapter.search({
        query: 'cafe',
        latitude: 10.75,
        longitude: 106.7,
        radiusMeters: 1000,
      }),
    ).resolves.toEqual([
      {
        providerPlaceId: 'places/abc',
        name: 'Cafe Example',
        categories: ['cafe', 'food'],
        latitude: 10.77,
        longitude: 106.69,
        formattedAddress: 'District 1',
        rating: 4.5,
        openingHours: { openNow: true },
      },
    ]);

    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('X-Goog-Api-Key')).toBe('test-key');
    expect(headers.get('X-Goog-FieldMask')).toContain('places.location');
  });

  it('does not call Google when its API key is missing', async () => {
    const request: jest.MockedFunction<PlacesFetch> = jest.fn();
    const adapter = new GooglePlacesAdapter('', request);

    await expect(
      adapter.search({
        query: 'cafe',
        latitude: 10.75,
        longitude: 106.7,
        radiusMeters: 1000,
      }),
    ).rejects.toMatchObject({ code: 'PLACE_SEARCH_UNAVAILABLE' });
    expect(request).not.toHaveBeenCalled();
  });
});
