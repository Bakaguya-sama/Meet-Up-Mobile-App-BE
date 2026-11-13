export interface VoteWinnerCandidate {
  recommendationPlaceId: string;
  canonicalCandidateKey: string;
  rank: number;
  voteCount: number;
  maxEtaSeconds: number;
  groupUtility: number;
}

export class VoteWinnerDomainService {
  select(candidates: VoteWinnerCandidate[]): VoteWinnerCandidate | null {
    if (!candidates.length) return null;
    return [...candidates].sort(
      (left, right) =>
        right.voteCount - left.voteCount ||
        left.maxEtaSeconds - right.maxEtaSeconds ||
        right.groupUtility - left.groupUtility ||
        left.rank - right.rank ||
        left.canonicalCandidateKey.localeCompare(right.canonicalCandidateKey),
    )[0];
  }
}
