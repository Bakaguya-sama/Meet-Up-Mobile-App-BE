import type { MeetupCandidateSearchPort } from '../ports/meetup-candidate-search.port';
import type { MeetupLocationPort } from '../ports/meetup-location.port';
import type { PlaceSearchPort } from '../ports/place-search.port';
import { FindPlaceCandidatesUseCase } from './find-place-candidates.use-case';

describe('FindPlaceCandidatesUseCase', () => {
  const meetups: jest.Mocked<MeetupCandidateSearchPort> = {
    getCandidateSearchContext: jest.fn(),
  };
  const locations: jest.Mocked<MeetupLocationPort> = {
    getActiveLocations: jest.fn(),
  };
  const places: jest.Mocked<PlaceSearchPort> = { search: jest.fn() };
  const useCase = new FindPlaceCandidatesUseCase(meetups, locations, places);

  beforeEach(() => jest.resetAllMocks());

  it('uses the centroid of current accepted-member locations for Google Places', async () => {
    meetups.getCandidateSearchContext.mockResolvedValue({
      meetupId: 'meetup-1',
      placeType: 'cafe',
      searchRadiusMeters: 1500,
      acceptedMemberUserIds: ['user-a', 'user-b'],
    });
    locations.getActiveLocations.mockResolvedValue([
      { userId: 'user-a', latitude: 10.7, longitude: 106.6 },
      { userId: 'user-b', latitude: 10.8, longitude: 106.8 },
    ]);
    places.search.mockResolvedValue([]);

    await expect(useCase.execute('ACTOR', 'MEETUP-1')).resolves.toEqual({
      meetupId: 'meetup-1',
      placeType: 'cafe',
      searchedAround: { latitude: 10.75, longitude: 106.7 },
      candidates: [],
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(places.search).toHaveBeenCalledWith({
      query: 'cafe',
      latitude: 10.75,
      longitude: 106.7,
      radiusMeters: 1500,
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(locations.getActiveLocations).toHaveBeenCalledWith(
      'meetup-1',
      'actor',
      ['user-a', 'user-b'],
    );
  });

  it('rejects a search when fewer than two shared locations are active', async () => {
    meetups.getCandidateSearchContext.mockResolvedValue({
      meetupId: 'meetup-1',
      placeType: 'cafe',
      searchRadiusMeters: 1500,
      acceptedMemberUserIds: ['user-a', 'user-b'],
    });
    locations.getActiveLocations.mockResolvedValue([
      { userId: 'user-a', latitude: 10.7, longitude: 106.6 },
    ]);

    await expect(useCase.execute('actor', 'meetup-1')).rejects.toMatchObject({
      code: 'RECOMMENDATION_INSUFFICIENT_LOCATIONS',
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(places.search).not.toHaveBeenCalled();
  });
});
