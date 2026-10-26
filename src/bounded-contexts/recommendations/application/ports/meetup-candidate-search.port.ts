export const MEETUP_CANDIDATE_SEARCH = Symbol('MEETUP_CANDIDATE_SEARCH');

export interface MeetupCandidateSearchContext {
  meetupId: string;
  placeType: string;
  searchRadiusMeters: number;
  acceptedMemberUserIds: string[];
}

export interface MeetupCandidateSearchPort {
  /**
   * Returns only the details required for candidate search and verifies that
   * the caller is the organizer of a meetup that has not been finalized.
   */
  getCandidateSearchContext(
    actorId: string,
    meetupId: string,
  ): Promise<MeetupCandidateSearchContext>;
}
