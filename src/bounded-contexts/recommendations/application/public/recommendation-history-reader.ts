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
export abstract class RecommendationHistoryReader {
  abstract getSelectedPlaceSnapshots(
    references: SelectedPlaceReference[],
  ): Promise<SelectedPlaceHistorySnapshot[]>;
}
