import type { LocationPort } from '../ports/location.port';
import { LocationAccessService } from '../services/location-access.service';
import { GetLatestLocationQuery } from './get-latest-location.query';

describe('GetLatestLocationQuery', () => {
  const sample = {
    latitude: 10.776923,
    longitude: 106.700947,
    accuracy: 12,
    recordedAt: new Date('2026-10-13T00:00:00.000Z'),
  };
  let get: jest.Mock;
  let projectForViewer: jest.Mock;
  let query: GetLatestLocationQuery;

  beforeEach(() => {
    get = jest.fn().mockResolvedValue(sample);
    projectForViewer = jest.fn().mockResolvedValue({
      ...sample,
      isApproximate: false,
    });
    const locations: jest.Mocked<LocationPort> = {
      save: jest.fn(),
      get,
      remove: jest.fn(),
    };
    const access = { projectForViewer } as LocationAccessService;
    query = new GetLatestLocationQuery(access, locations);
  });

  it('uses a meetup-scoped key when reading for a meetup viewer', async () => {
    const input = {
      ownerId: 'owner-id',
      viewerId: 'viewer-id',
      scope: 'meetup' as const,
      meetupId: 'meetup-a',
    };

    await query.execute(input);

    expect(get).toHaveBeenCalledWith('owner-id', 'meetup-a');
    expect(projectForViewer).toHaveBeenCalledWith(input, sample);
  });

  it('uses the friend-scoped key without a meetup id', async () => {
    await query.execute({
      ownerId: 'owner-id',
      viewerId: 'viewer-id',
      scope: 'friends',
    });

    expect(get).toHaveBeenCalledWith('owner-id', undefined);
  });
});
