import { GooglePlacesAdapter, type PlacesFetch } from './google-places.adapter';

describe('GooglePlacesAdapter', () => {
  it('requests only candidate fields and normalizes the Places response', async () => {
    const request: jest.MockedFunction<PlacesFetch> = jest.fn();
    request.mockResolvedValue({
      ok: true,
      status: 200,
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
        provider: 'google-places',
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

  it('passes pageToken/openNow and exposes the next page token', async () => {
    const request: jest.MockedFunction<PlacesFetch> = jest.fn();
    request.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ places: [], nextPageToken: 'next-2' }),
    });
    const adapter = new GooglePlacesAdapter('test-key', request);

    await expect(
      adapter.searchPage({
        query: 'coffee',
        includedType: 'cafe',
        latitude: 10.7,
        longitude: 106.7,
        radiusMeters: 1000,
        openNow: true,
        pageToken: 'next-1',
      }),
    ).resolves.toEqual({ candidates: [], nextPageToken: 'next-2' });
    expect(JSON.parse(request.mock.calls[0][1].body as string)).toMatchObject({
      includedType: 'cafe',
      openNow: true,
      pageToken: 'next-1',
    });
  });

  it('retries transient HTTP failures within the configured attempt limit', async () => {
    const request: jest.MockedFunction<PlacesFetch> = jest.fn();
    request
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ places: [] }),
      });
    const adapter = new GooglePlacesAdapter('test-key', request, 2, 100);

    await expect(
      adapter.search({
        query: 'cafe',
        latitude: 10.7,
        longitude: 106.7,
        radiusMeters: 1000,
      }),
    ).resolves.toEqual([]);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
