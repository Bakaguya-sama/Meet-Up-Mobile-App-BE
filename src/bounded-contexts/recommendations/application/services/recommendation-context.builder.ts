import { RecommendationError } from '../../domain/recommendation.error';
import type { MeetupCandidateSearchPort } from '../ports/meetup-candidate-search.port';
import type { MeetupLocationPort } from '../ports/meetup-location.port';

export interface RecommendationMemberContext {
  participantId: string;
  latitude: number;
  longitude: number;
}

export interface RecommendationContext {
  meetupId: string;
  requestedAt: string;
  scheduledAt: string;
  members: RecommendationMemberContext[];
  searchCenter: { latitude: number; longitude: number };
}

export class RecommendationContextBuilder {
  constructor(
    private readonly meetups: MeetupCandidateSearchPort,
    private readonly locations: MeetupLocationPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async build(
    actorId: string,
    meetupId: string,
  ): Promise<RecommendationContext> {
    const meetup = await this.meetups.getCandidateSearchContext(
      actorId.toLowerCase(),
      meetupId.toLowerCase(),
    );
    const acceptedMembers = uniqueMembers(meetup.acceptedMembers);
    const locations = await this.locations.getActiveLocations(
      meetup.meetupId,
      actorId.toLowerCase(),
      acceptedMembers.map((member) => member.userId),
    );
    const locationByUserId = new Map(
      locations
        .filter(isValidCoordinate)
        .map((location) => [location.userId.toLowerCase(), location] as const),
    );
    const members = acceptedMembers
      .flatMap((member) => {
        const location = locationByUserId.get(member.userId);
        return location
          ? [
              {
                participantId: member.participantId,
                latitude: location.latitude,
                longitude: location.longitude,
              },
            ]
          : [];
      })
      .sort((a, b) => a.participantId.localeCompare(b.participantId));
    if (members.length < 2) {
      throw new RecommendationError(
        'INSUFFICIENT_VALID_MEMBERS',
        'At least two accepted members must share a valid current location',
      );
    }
    return {
      meetupId: meetup.meetupId,
      requestedAt: this.now().toISOString(),
      scheduledAt: meetup.scheduledAt.toISOString(),
      members,
      searchCenter: medoid(members),
    };
  }
}

function uniqueMembers(
  members: Array<{ participantId: string; userId: string }>,
) {
  const byParticipant = new Map<
    string,
    { participantId: string; userId: string }
  >();
  for (const member of members) {
    const participantId = member.participantId.toLowerCase();
    if (!byParticipant.has(participantId)) {
      byParticipant.set(participantId, {
        participantId,
        userId: member.userId.toLowerCase(),
      });
    }
  }
  return [...byParticipant.values()];
}

function isValidCoordinate(location: {
  latitude: number;
  longitude: number;
}): boolean {
  return (
    Number.isFinite(location.latitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    Number.isFinite(location.longitude) &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

function medoid(members: RecommendationMemberContext[]) {
  return members
    .map((candidate) => ({
      candidate,
      total: members.reduce(
        (sum, member) => sum + haversine(candidate, member),
        0,
      ),
    }))
    .sort(
      (a, b) =>
        a.total - b.total ||
        a.candidate.participantId.localeCompare(b.candidate.participantId),
    )[0].candidate;
}

function haversine(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const radians = Math.PI / 180;
  const latitudeDelta = (b.latitude - a.latitude) * radians;
  const longitudeDelta = (b.longitude - a.longitude) * radians;
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(a.latitude * radians) *
      Math.cos(b.latitude * radians) *
      Math.sin(longitudeDelta / 2) ** 2;
  const clamped = Math.min(1, Math.max(0, value));
  return 2 * 6_371_000 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
}
