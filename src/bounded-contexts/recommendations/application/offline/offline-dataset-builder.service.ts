import { createHash, createHmac } from 'node:crypto';
import {
  OFFLINE_DATASET_SCHEMA_VERSION,
  OFFLINE_REDACTION_VERSION,
  type OfflineDatasetManifest,
  type OfflineDatasetRow,
  type OfflineEvaluationSource,
} from './offline-evaluation.types';
import { FeedbackLabelPolicy } from './feedback-label.policy';

export class OfflineDatasetBuilderService {
  constructor(
    private readonly source: OfflineEvaluationSource,
    private readonly pseudonymizationSalt: string,
    private readonly labels = new FeedbackLabelPolicy(),
  ) {
    if (!pseudonymizationSalt)
      throw new Error('OFFLINE_DATASET_PSEUDONYMIZATION_SALT is required');
  }

  async build(input: {
    from: Date;
    to: Date;
    algorithmVersion?: string;
    configVersion?: string;
    generatedAt?: Date;
    generatorCommitSha?: string | null;
  }) {
    if (
      !Number.isFinite(input.from.getTime()) ||
      !Number.isFinite(input.to.getTime()) ||
      input.from >= input.to
    ) {
      throw new Error('Dataset window must have a valid from < to range');
    }
    // Defend against a source implementation that returns a superset: the dataset
    // contract is explicitly [from, to) and version-scoped.
    const runs = (await this.source.readCompletedRuns(input)).filter(
      (run) =>
        run.requestedAt >= input.from &&
        run.requestedAt < input.to &&
        (!input.algorithmVersion ||
          run.algorithmVersion === input.algorithmVersion) &&
        (!input.configVersion || run.configVersion === input.configVersion),
    );
    const rows: OfflineDatasetRow[] = [];
    let incompleteSnapshotImpressionCount = 0;
    let notShownCandidateCount = 0;
    for (const run of runs.sort(
      (a, b) =>
        a.requestedAt.getTime() - b.requestedAt.getTime() ||
        a.id.localeCompare(b.id),
    )) {
      const candidateByKey = new Map(
        run.candidates.map((candidate) => [
          candidate.canonicalCandidateKey,
          candidate,
        ]),
      );
      const featuresByKeyAndParticipant = new Map(
        run.memberFeatures.map((feature) => [
          `${feature.participantId}:${feature.canonicalCandidateKey}`,
          feature,
        ]),
      );
      const groupSize = new Set(
        run.memberFeatures.map((feature) => feature.participantId),
      ).size;
      notShownCandidateCount += run.candidates.filter(
        (candidate) =>
          !run.impressions.some(
            (impression) =>
              impression.canonicalCandidateKey ===
              candidate.canonicalCandidateKey,
          ),
      ).length;
      for (const impression of [...run.impressions].sort(
        (a, b) =>
          a.participantId.localeCompare(b.participantId) ||
          a.rank - b.rank ||
          a.canonicalCandidateKey.localeCompare(b.canonicalCandidateKey),
      )) {
        const feature = featuresByKeyAndParticipant.get(
          `${impression.participantId}:${impression.canonicalCandidateKey}`,
        );
        const candidate = candidateByKey.get(impression.canonicalCandidateKey);
        if (!feature || !candidate) {
          incompleteSnapshotImpressionCount += 1;
          continue; // never synthesize a zero-filled feature vector
        }
        const matchingFeedback = run.feedback.filter(
          (event) =>
            event.canonicalCandidateKey === impression.canonicalCandidateKey &&
            (event.participantId === impression.participantId ||
              event.eventType === 'MEETUP_PLACE_SELECTED'),
        );
        const labelled = this.labels.label(matchingFeedback);
        rows.push({
          runId: run.id,
          canonicalCandidateKey: impression.canonicalCandidateKey,
          participantPseudonym: this.pseudonymize(impression.participantId),
          recommendationTimestamp: run.requestedAt.toISOString(),
          algorithmVersion: run.algorithmVersion,
          configVersion: run.configVersion,
          featureSchemaVersion: run.featureSchemaVersion,
          rankingStrategy: run.rankingStrategy,
          groupSize,
          category: candidate.sourceCategories[0] ?? null,
          impressionRank: impression.rank,
          originalRank: candidate.finalRank,
          label: labelled.label,
          shown: true,
          rawEvents: labelled.rawEvents,
          features: {
            etaSeconds: feature.etaSeconds,
            distanceMeters: feature.distanceMeters,
            staticDurationSeconds: feature.staticDurationSeconds,
            travelUtility: feature.travelUtility,
            preferenceUtility: feature.preferenceUtility,
            placeQualityUtility: feature.placeQualityUtility,
            memberUtility: feature.memberUtility,
            rankingUtility: feature.rankingUtility,
            groupUtility: candidate.groupUtility,
            leastMiseryUtility: candidate.candidateLeastMiseryUtility,
            avgEtaSeconds: candidate.avgEtaSeconds,
            maxEtaSeconds: candidate.maxEtaSeconds,
            etaRangeSeconds: candidate.etaRangeSeconds,
            candidateRating: candidate.rating0To5,
            candidateRatingCount: candidate.userRatingCount,
            scheduledOpeningStatus: candidate.scheduledOpeningStatus,
            missingFlags: [...feature.missingFlags].sort(),
          },
        });
      }
    }
    rows.sort(
      (a, b) =>
        a.recommendationTimestamp.localeCompare(b.recommendationTimestamp) ||
        a.runId.localeCompare(b.runId) ||
        a.participantPseudonym.localeCompare(b.participantPseudonym) ||
        a.impressionRank - b.impressionRank ||
        a.canonicalCandidateKey.localeCompare(b.canonicalCandidateKey),
    );
    const manifest: OfflineDatasetManifest = {
      datasetSchemaVersion: OFFLINE_DATASET_SCHEMA_VERSION,
      labelVersion: this.labels.version,
      redactionPolicyVersion: OFFLINE_REDACTION_VERSION,
      featureSchemaVersions: unique(
        rows.map((row) => row.featureSchemaVersion),
      ),
      sourceTimeWindow: {
        from: input.from.toISOString(),
        to: input.to.toISOString(),
      },
      generatedAt: (input.generatedAt ?? new Date()).toISOString(),
      rowCount: rows.length,
      sourceRunCount: new Set(rows.map((row) => row.runId)).size,
      algorithmVersions: unique(rows.map((row) => row.algorithmVersion)),
      configVersions: unique(rows.map((row) => row.configVersion)),
      modelVersions: [],
      contentSha256: checksum(rows),
      generatorCommitSha: input.generatorCommitSha ?? null,
    };
    return {
      rows,
      manifest,
      dataQuality: {
        incompleteSnapshotImpressionCount,
        notShownCandidateCount,
        warningCodes: [
          ...(incompleteSnapshotImpressionCount
            ? ['INCOMPLETE_SNAPSHOT_IMPRESSION_EXCLUDED']
            : []),
          ...(notShownCandidateCount
            ? ['NOT_SHOWN_CANDIDATES_ARE_UNKNOWN']
            : []),
        ],
      },
    };
  }

  private pseudonymize(participantId: string): string {
    return `p_${createHmac('sha256', this.pseudonymizationSalt).update(participantId).digest('hex').slice(0, 24)}`;
  }
}

function checksum(rows: OfflineDatasetRow[]) {
  return createHash('sha256')
    .update(rows.map((row) => JSON.stringify(row)).join('\n'))
    .digest('hex');
}
function unique(values: string[]) {
  return [...new Set(values)].sort();
}
