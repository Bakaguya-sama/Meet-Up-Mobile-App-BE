export type VotingCandidate = {
  recommendationPlaceId: string;
  canonicalCandidateKey: string;
  rank: number;
  maxEtaSeconds: number;
  groupUtility: number;
};

export type VotingRecommendationRun = {
  meetupId: string;
  runId: string;
  scheduledAtSnapshot: Date;
  isStale: boolean;
  candidates: VotingCandidate[];
};

/** Public, privacy-minimal recommendation contract for meetup voting. */
export class RecommendationVotingReader {
  getDisplayedRun(meetupId: string, runId: string): Promise<VotingRecommendationRun | null> {
    throw new Error('RecommendationVotingReader must be provided by its context');
  }
}
