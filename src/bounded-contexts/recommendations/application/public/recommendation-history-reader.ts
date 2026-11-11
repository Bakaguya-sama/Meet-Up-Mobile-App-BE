export type SelectedPlaceReference = {
  meetupId: string;
  runId: string;
  recommendationPlaceId: string;
};

export type SelectedPlaceHistorySnapshot = SelectedPlaceReference & {
  canonicalCandidateKey: string;
  provider: string;
  providerPlaceId: string;
  name: string;
};

/** Privacy-minimal reader for the selected place stored by Recommendations. */
export class RecommendationHistoryReader {
  getSelectedPlaceSnapshots(
    references: SelectedPlaceReference[],
  ): Promise<SelectedPlaceHistorySnapshot[]> {
    throw new Error('RecommendationHistoryReader must be provided by its context');
  }
}
