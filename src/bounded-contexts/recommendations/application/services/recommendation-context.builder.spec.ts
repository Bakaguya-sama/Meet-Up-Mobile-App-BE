import type { MeetupCandidateSearchPort } from '../ports/meetup-candidate-search.port';
import type { MeetupLocationPort } from '../ports/meetup-location.port';
import { RecommendationContextBuilder } from './recommendation-context.builder';

describe('RecommendationContextBuilder privacy/location boundary', () => {
  const meetups: jest.Mocked<MeetupCandidateSearchPort> = {
    getCandidateSearchContext: jest.fn(),
  };
  const locations: jest.Mocked<MeetupLocationPort> = {
    getActiveLocations: jest.fn(),
  };
  const builder = new RecommendationContextBuilder(
    meetups,
    locations,
    () => new Date('2026-10-27T03:00:00.000Z'),
  );

  beforeEach(() => {
    jest.resetAllMocks();
    meetups.getCandidateSearchContext.mockResolvedValue({
      meetupId: 'meetup',
      placeType: 'cafe',
      searchRadiusMeters: 1000,
      scheduledAt: new Date('2026-10-28T03:00:00.000Z'),
      acceptedMembers: [
        { participantId: 'participant-b', userId: 'user-b' },
        { participantId: 'participant-a', userId: 'user-a' },
        { participantId: 'participant-c', userId: 'user-c' },
      ],
      acceptedMemberUserIds: ['user-b', 'user-a', 'user-c'],
    });
  });

  it('uses only privacy-authorized projected locations and sorts participants', async () => {
    locations.getActiveLocations.mockResolvedValue([
      { userId: 'user-b', latitude: 10.7, longitude: 106.7 },
      { userId: 'user-a', latitude: 10.71, longitude: 106.71 },
    ]);

    const context = await builder.build('actor', 'meetup');

    expect(context.members.map((member) => member.participantId)).toEqual([
      'participant-a',
      'participant-b',
    ]);
    expect(JSON.stringify(context)).not.toContain('user-');
    expect(context.requestedAt).toBe('2026-10-27T03:00:00.000Z');
  });

  it.each([
    [[]],
    [[{ userId: 'user-a', latitude: 10.7, longitude: 106.7 }]],
    [
      [
        { userId: 'user-a', latitude: Number.NaN, longitude: 106.7 },
        { userId: 'user-b', latitude: 91, longitude: 106.7 },
      ],
    ],
  ])(
    'rejects when missing, denied, stale, or invalid data leaves <2 members',
    async (samples) => {
      locations.getActiveLocations.mockResolvedValue(samples);
      await expect(builder.build('actor', 'meetup')).rejects.toMatchObject({
        code: 'INSUFFICIENT_VALID_MEMBERS',
      });
    },
  );

  it('selects the deterministic member medoid with participant tie-break', async () => {
    locations.getActiveLocations.mockResolvedValue([
      { userId: 'user-a', latitude: 10, longitude: 106 },
      { userId: 'user-b', latitude: 10, longitude: 108 },
      { userId: 'user-c', latitude: 10, longitude: 107 },
    ]);
    await expect(builder.build('actor', 'meetup')).resolves.toMatchObject({
      searchCenter: { participantId: 'participant-c' },
    });
  });
});
