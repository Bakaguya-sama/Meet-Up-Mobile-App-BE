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
              primaryTypeDisplayName: { text: 'Cafe' },
              types: ['cafe', 'food'],
              location: { latitude: 10.77, longitude: 106.69 },
              formattedAddress: 'District 1',
              nationalPhoneNumber: '028 1234 5678',
              websiteUri: 'https://example.com',
              googleMapsUri: 'https://maps.google.com/?cid=123',
              priceLevel: 'PRICE_LEVEL_MODERATE',
              rating: 4.5,
              userRatingCount: 99,
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
        primaryTypeDisplayName: 'Cafe',
        latitude: 10.77,
        longitude: 106.69,
        formattedAddress: 'District 1',
        nationalPhoneNumber: '028 1234 5678',
        websiteUri: 'https://example.com',
        googleMapsUri: 'https://maps.google.com/?cid=123',
        priceLevel: 'PRICE_LEVEL_MODERATE',
        rating: 4.5,
        userRatingCount: 99,
        openingHours: { openNow: true },
      },
    ]);

    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({
      languageCode: 'vi',
      regionCode: 'VN',
    });
    const headers = new Headers(init.headers);
    expect(headers.get('X-Goog-Api-Key')).toBe('test-key');
    expect(headers.get('X-Goog-FieldMask')).toContain('places.location');
    expect(headers.get('X-Goog-FieldMask')).toContain(
      'places.nationalPhoneNumber',
    );
    expect(headers.get('X-Goog-FieldMask')).toContain('places.websiteUri');
    expect(headers.get('X-Goog-FieldMask')).toContain('places.priceLevel');
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

  it('loads live place details by Google Place ID with a details field mask', async () => {
    const request: jest.MockedFunction<PlacesFetch> = jest.fn();
    request.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: 'places/abc',
          displayName: { text: 'Cafe Example' },
          primaryTypeDisplayName: { text: 'Cafe' },
          types: ['cafe'],
          location: { latitude: 10.77, longitude: 106.69 },
          formattedAddress: 'District 1',
          nationalPhoneNumber: '028 1234 5678',
          websiteUri: 'https://example.com',
          googleMapsUri: 'https://maps.google.com/?cid=123',
          priceLevel: 'PRICE_LEVEL_MODERATE',
          rating: 4.5,
          userRatingCount: 99,
          utcOffsetMinutes: 420,
          timeZone: { id: 'Asia/Ho_Chi_Minh' },
          currentOpeningHours: {
            periods: [
              {
                open: { day: 1, hour: 8, minute: 0 },
                close: { day: 1, hour: 22, minute: 0 },
              },
            ],
          },
          regularOpeningHours: {
            periods: [
              {
                open: { day: 1, hour: 8, minute: 0 },
                close: { day: 1, hour: 22, minute: 0 },
              },
            ],
          },
        }),
    });
    const adapter = new GooglePlacesAdapter('test-key', request);

    await expect(adapter.getDetails('places/abc')).resolves.toMatchObject({
      provider: 'google-places',
      providerPlaceId: 'places/abc',
      primaryTypeDisplayName: 'Cafe',
      formattedAddress: 'District 1',
      nationalPhoneNumber: '028 1234 5678',
      websiteUri: 'https://example.com',
      googleMapsUri: 'https://maps.google.com/?cid=123',
      priceLevel: 'PRICE_LEVEL_MODERATE',
      rating: 4.5,
      userRatingCount: 99,
      currentOpeningHours: { source: 'CURRENT' },
      regularOpeningHours: { source: 'REGULAR' },
      timeZoneId: 'Asia/Ho_Chi_Minh',
      utcOffsetMinutes: 420,
    });
    expect(request).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places/abc?languageCode=vi&regionCode=VN',
      expect.objectContaining({ method: 'GET' }),
    );
    const headers = new Headers(request.mock.calls[0][1].headers);
    expect(headers.get('X-Goog-FieldMask')).toContain('priceLevel');
    expect(headers.get('X-Goog-FieldMask')).toContain('websiteUri');
    expect(headers.get('X-Goog-FieldMask')).not.toContain('places.');
    expect(headers.get('X-Goog-FieldMask')).toContain('currentOpeningHours');
    expect(headers.get('X-Goog-FieldMask')).toContain('regularOpeningHours');
  });

  it('returns null for missing Google places and rejects invalid IDs without a request', async () => {
    const request: jest.MockedFunction<PlacesFetch> = jest.fn();
    request.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    });
    const adapter = new GooglePlacesAdapter('test-key', request);

    await expect(adapter.getDetails('places/missing')).resolves.toBeNull();
    await expect(adapter.getDetails('places/invalid/id')).resolves.toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
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
    expect(
      new Headers(request.mock.calls[0][1].headers).get('X-Goog-FieldMask'),
    ).toContain('places.currentOpeningHours.openNow');
  });

  it('requests and normalizes scheduled opening fields without sending openNow', async () => {
    const request: jest.MockedFunction<PlacesFetch> = jest.fn();
    request.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          places: [
            {
              id: 'places/scheduled',
              displayName: { text: 'Scheduled Cafe' },
              types: ['cafe'],
              location: { latitude: 10.77, longitude: 106.69 },
              utcOffsetMinutes: 420,
              currentOpeningHours: {
                periods: [
                  {
                    open: {
                      day: 5,
                      hour: 18,
                      minute: 0,
                      date: { year: 2026, month: 10, day: 30 },
                    },
                    close: {
                      day: 5,
                      hour: 22,
                      minute: 0,
                      date: { year: 2026, month: 10, day: 30 },
                    },
                  },
                ],
              },
              regularOpeningHours: {
                periods: [
                  {
                    open: { day: 5, hour: 18, minute: 0 },
                    close: { day: 5, hour: 22, minute: 0 },
                  },
                ],
              },
            },
          ],
        }),
    });
    const adapter = new GooglePlacesAdapter(
      'test-key',
      request,
      2,
      8_000,
      undefined,
      () => new Date('2026-10-30T00:00:00Z'),
    );

    const page = await adapter.searchPage({
      query: 'cafe',
      latitude: 10.75,
      longitude: 106.7,
      radiusMeters: 1000,
      includeScheduledOpeningFields: true,
    });

    expect(
      JSON.parse(request.mock.calls[0][1].body as string),
    ).not.toHaveProperty('openNow');
    const fieldMask = new Headers(request.mock.calls[0][1].headers).get(
      'X-Goog-FieldMask',
    );
    expect(fieldMask).toContain('places.currentOpeningHours');
    expect(fieldMask).toContain('places.regularOpeningHours');
    expect(fieldMask).toContain('places.utcOffsetMinutes');
    expect(page.candidates[0]).toMatchObject({
      utcOffsetMinutes: 420,
      currentOpeningHours: {
        source: 'CURRENT',
        coverageStartDate: '2026-10-30',
        coverageEndDate: '2026-11-05',
      },
      regularOpeningHours: { source: 'REGULAR' },
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
