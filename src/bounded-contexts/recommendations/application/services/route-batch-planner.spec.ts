import { RouteBatchPlanner } from './route-batch-planner';

describe('RouteBatchPlanner', () => {
  it('splits both axes and preserves each global pair exactly once', () => {
    const planner = new RouteBatchPlanner(4);
    const origins = ['p3', 'p1', 'p2'].map((participantId, index) => ({
      participantId,
      latitude: 10 + index,
      longitude: 106,
    }));
    const destinations = ['c4', 'c1', 'c3', 'c2', 'c5'].map(
      (canonicalCandidateKey, index) => ({
        canonicalCandidateKey,
        latitude: 10,
        longitude: 106 + index,
      }),
    );
    const batches = planner.plan(origins, destinations);
    expect(batches).toHaveLength(5);
    expect(batches.every((batch) => batch.elementCount <= 4)).toBe(true);
    const pairs = batches.flatMap((batch) =>
      batch.origins.flatMap((origin) =>
        batch.destinations.map(
          (destination) =>
            `${origin.participantId}:${destination.canonicalCandidateKey}`,
        ),
      ),
    );
    expect(pairs).toHaveLength(15);
    expect(new Set(pairs).size).toBe(15);
    expect([...pairs].sort()).toEqual(
      origins
        .flatMap((origin) =>
          destinations.map(
            (destination) =>
              `${origin.participantId}:${destination.canonicalCandidateKey}`,
          ),
        )
        .sort(),
    );
  });

  it('groups members by travel mode and preserves canonical pairs', () => {
    const batches = new RouteBatchPlanner(10).plan(
      [
        { participantId: 'scooter', latitude: 10, longitude: 106 },
        {
          participantId: 'driver',
          latitude: 11,
          longitude: 106,
          travelMode: 'DRIVE' as const,
        },
      ],
      [{ canonicalCandidateKey: 'c1', latitude: 10, longitude: 106 }],
    );
    expect(batches.map((batch) => batch.travelMode)).toEqual([
      'DRIVE',
      'TWO_WHEELER',
    ]);
    expect(
      batches.flatMap((batch) =>
        batch.origins.map((origin) => origin.participantId),
      ),
    ).toEqual(['driver', 'scooter']);
  });
});
