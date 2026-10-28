import { GoogleRoutesAdapter } from './google-routes.adapter';

describe('GoogleRoutesAdapter', () => {
  const input = {
    origins: [
      { participantId: 'p1', latitude: 10, longitude: 106 },
      { participantId: 'p2', latitude: 11, longitude: 107 },
    ],
    destinations: [
      {
        canonicalCandidateKey: 'google:c1',
        latitude: 12,
        longitude: 108,
      },
    ],
    travelMode: 'TWO_WHEELER' as const,
  };

  it('joins out-of-order local indices and maps element failures to NO_ROUTE', async () => {
    const request = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          {
            originIndex: 1,
            destinationIndex: 0,
            condition: 'ROUTE_NOT_FOUND',
            status: { code: 5 },
          },
          {
            originIndex: 0,
            destinationIndex: 0,
            condition: 'ROUTE_EXISTS',
            distanceMeters: 1200,
            duration: '345.5s',
          },
        ]),
    });
    const result = await new GoogleRoutesAdapter('key', request).calculateBatch(
      input,
    );
    expect(result.features).toEqual([
      {
        participantId: 'p1',
        canonicalCandidateKey: 'google:c1',
        etaSeconds: 345.5,
        distanceMeters: 1200,
        status: 'OK',
      },
    ]);
    expect(result.failures).toEqual([
      {
        participantId: 'p2',
        canonicalCandidateKey: 'google:c1',
        status: 'NO_ROUTE',
        providerCode: 'ROUTE_NOT_FOUND',
      },
    ]);
    const firstCall = request.mock.calls[0] as [string, RequestInit];
    expect(typeof firstCall[1].body).toBe('string');
    const requestBody = firstCall[1].body as string;
    expect(JSON.parse(requestBody)).toMatchObject({
      travelMode: 'TWO_WHEELER',
    });
  });

  it('retries a whole-batch transient failure and returns the contract error', async () => {
    const request = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    });
    await expect(
      new GoogleRoutesAdapter('key', request, 2, 100).calculateBatch(input),
    ).rejects.toMatchObject({ code: 'ROUTE_MATRIX_UNAVAILABLE' });
    expect(request).toHaveBeenCalledTimes(2);
  });
});
