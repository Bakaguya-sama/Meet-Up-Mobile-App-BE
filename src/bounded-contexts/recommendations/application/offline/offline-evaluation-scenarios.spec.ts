import { OfflineDatasetBuilderService } from './offline-dataset-builder.service';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOfflineEvaluator } from './offline-evaluator.service';
import { rankingMetrics } from './offline-metrics.service';
import { splitName, validateTimeSplit } from './time-split.policy';
import type {
  OfflineDatasetRow,
  OfflineEvaluationSource,
  OfflineSourceRun,
} from './offline-evaluation.types';
import { RECOMMENDATION_CONFIG_DEV_V1 } from '../recommendation-config';
import { writeOfflineEvaluationArtifacts } from '../../infrastructure/offline/offline-evaluation-artifact-writer';

const window = {
  from: new Date('2026-01-01T00:00:00.000Z'),
  to: new Date('2026-02-01T00:00:00.000Z'),
  generatedAt: new Date('2026-02-02T00:00:00.000Z'),
};

describe('offline evaluation realistic synthetic scenarios', () => {
  it('models a three-member mixed-category meetup without leaking raw identities or unshown candidates', async () => {
    const source = fixedSource([scenarioRun({ participants: ['member-a', 'member-b', 'member-c'], categories: ['cafe', 'restaurant', 'park'], shown: ['cafe', 'restaurant'], feedback: [event('member-a', 'cafe', 'PLACE_VOTED'), event(null, 'cafe', 'MEETUP_PLACE_SELECTED'), event('member-b', 'restaurant', 'NAVIGATION_OPENED')] })]);
    const built = await new OfflineDatasetBuilderService(source, 'salt-a').build(window);
    expect(built.rows).toHaveLength(6); // three members × two actually exposed candidates
    expect(built.rows.every((row) => row.groupSize === 3)).toBe(true);
    expect(built.rows.map((row) => row.category)).toEqual(expect.arrayContaining(['cafe', 'restaurant']));
    expect(built.rows.some((row) => row.canonicalCandidateKey === 'park')).toBe(false);
    expect(built.dataQuality.notShownCandidateCount).toBe(1);
    expect(JSON.stringify(built)).not.toContain('member-a');
    expect(JSON.stringify(built)).not.toMatch(/latitude|longitude|providerPlaceId|candidateName/i);
  });

  it('uses group final selection for every exposed member but retains participant-local votes separately', async () => {
    const source = fixedSource([scenarioRun({ participants: ['a', 'b'], shown: ['cafe', 'restaurant'], feedback: [event('a', 'cafe', 'PLACE_VOTED'), event('b', 'restaurant', 'PLACE_VOTED'), event(null, 'cafe', 'MEETUP_PLACE_SELECTED')] })]);
    const rows = (await new OfflineDatasetBuilderService(source, 'salt').build(window)).rows;
    expect(rows.filter((row) => row.canonicalCandidateKey === 'cafe').map((row) => row.label)).toEqual([3, 3]);
    expect(rows.find((row) => row.canonicalCandidateKey === 'restaurant' && row.rawEvents.PLACE_VOTED)?.label).toBe(2);
  });

  it('keeps navigation/vote/selection precedence and raw counts deterministic', async () => {
    const source = fixedSource([scenarioRun({ feedback: [event('member-a', 'cafe', 'NAVIGATION_OPENED'), event('member-a', 'cafe', 'PLACE_VOTED'), event(null, 'cafe', 'MEETUP_PLACE_SELECTED'), event('member-a', 'cafe', 'MEETUP_COMPLETED')] })]);
    const row = (await new OfflineDatasetBuilderService(source, 'salt').build(window)).rows[0];
    expect(row.label).toBe(3);
    expect(row.rawEvents).toMatchObject({ NAVIGATION_OPENED: 1, PLACE_VOTED: 1, MEETUP_PLACE_SELECTED: 1, MEETUP_COMPLETED: 1 });
  });

  it('excludes an impression with an incomplete snapshot instead of manufacturing a negative feature row', async () => {
    const damaged = scenarioRun({ shown: ['cafe'] });
    damaged.memberFeatures = [];
    const built = await new OfflineDatasetBuilderService(fixedSource([damaged]), 'salt').build(window);
    expect(built.rows).toEqual([]);
    expect(built.dataQuality).toMatchObject({ incompleteSnapshotImpressionCount: 1, warningCodes: ['INCOMPLETE_SNAPSHOT_IMPRESSION_EXCLUDED', 'NOT_SHOWN_CANDIDATES_ARE_UNKNOWN'] });
  });

  it('uses [from, to) time and version filters without future rows', async () => {
    const atFrom = scenarioRun({ id: 'from', requestedAt: '2026-01-01T00:00:00.000Z' });
    const atTo = scenarioRun({ id: 'to', requestedAt: '2026-02-01T00:00:00.000Z', algorithmVersion: 'engine-v2' });
    const source = fixedSource([atTo, atFrom]);
    const built = await new OfflineDatasetBuilderService(source, 'salt').build({ ...window, algorithmVersion: 'engine-v1' });
    expect(built.rows.map((row) => row.runId)).toEqual(['from', 'from']);
    expect(source.readCompletedRuns).toHaveBeenCalledWith(expect.objectContaining({ algorithmVersion: 'engine-v1' }));
  });

  it('changes pseudonyms and checksum when the salt changes, but not for a deterministic rerun', async () => {
    const source = fixedSource([scenarioRun({})]);
    const same = new OfflineDatasetBuilderService(source, 'one');
    const first = await same.build(window); const second = await same.build(window);
    const other = await new OfflineDatasetBuilderService(source, 'two').build(window);
    expect(first.manifest.contentSha256).toBe(second.manifest.contentSha256);
    expect(first.rows[0].participantPseudonym).not.toBe(other.rows[0].participantPseudonym);
    expect(first.manifest.contentSha256).not.toBe(other.manifest.contentSha256);
  });

  it('reports HitRate and NDCG boundaries without turning no-positive groups into zero scores', () => {
    const ranked = [row(1, 0), row(2, 0), row(3, 3), row(4, 1), row(5, 2)];
    expect(rankingMetrics(ranked, 1).hitRate).toBe(0);
    expect(rankingMetrics(ranked, 3).hitRate).toBe(1);
    expect(rankingMetrics(ranked, 5).ndcg).toBeGreaterThan(0);
    const noPositive = rankingMetrics([row(1, 0)], 5);
    expect(noPositive).toMatchObject({ hitRate: null, ndcg: null, coverage: 0, excludedRunCount: 1 });
  });

  it('segments two, three, and five-member groups by category/version and replays all baselines offline', async () => {
    const source = fixedSource([
      scenarioRun({ id: 'two', participants: ['a', 'b'], categories: ['cafe', 'restaurant'], shown: ['cafe'], configVersion: 'config-a' }),
      scenarioRun({ id: 'three', participants: ['a', 'b', 'c'], categories: ['restaurant', 'park'], shown: ['restaurant'], configVersion: 'config-b' }),
      scenarioRun({ id: 'five', participants: ['a', 'b', 'c', 'd', 'e'], categories: ['park', 'cafe'], shown: ['park'], algorithmVersion: 'engine-v2' }),
    ]);
    const report = await createOfflineEvaluator(source, RECOMMENDATION_CONFIG_DEV_V1).evaluate({ from: window.from, to: window.to, k: 5 });
    expect(report).toHaveLength(3);
    report.forEach((strategy) => {
      expect(strategy.status).toBe('OK');
      expect(Object.keys(strategy.breakdown.groupSize)).toEqual(expect.arrayContaining(['2', '3', '5']));
      expect(Object.keys(strategy.breakdown.category)).toEqual(expect.arrayContaining(['cafe', 'park', 'restaurant']));
      expect(Object.keys(strategy.breakdown.algorithmConfigVersion)).toEqual(expect.arrayContaining(['engine-v1:config-a', 'engine-v1:config-b', 'engine-v2:config-v1']));
    });
  });

  it('reports unavailable baselines rather than silently falling back when immutable replay state is absent', async () => {
    const broken = scenarioRun({}); broken.randomSeed = null;
    const report = await createOfflineEvaluator(fixedSource([broken]), RECOMMENDATION_CONFIG_DEV_V1).evaluate({ from: window.from, to: window.to, k: 3 });
    expect(report.every((strategy) => strategy.status === 'UNAVAILABLE')).toBe(true);
    expect(report[0].error).toContain('lacks immutable replay seed');
  });

  it('accepts ordered temporal splits and rejects overlap or a future record assigned to train', () => {
    const split = { train: { from: new Date('2026-01-01'), to: new Date('2026-02-01') }, validation: { from: new Date('2026-02-01'), to: new Date('2026-03-01') }, test: { from: new Date('2026-03-01'), to: new Date('2026-04-01') } };
    expect(() => validateTimeSplit(split)).not.toThrow();
    expect(splitName(new Date('2026-03-15'), split)).toBe('test');
    expect(splitName(new Date('2026-04-01'), split)).toBeNull();
    expect(() => validateTimeSplit({ ...split, validation: { from: new Date('2026-01-15'), to: new Date('2026-03-01') } })).toThrow();
  });

  it('writes a CLI-equivalent NDJSON, manifest, and report artifact to a temporary directory', async () => {
    const source = fixedSource([scenarioRun({ participants: ['artifact-a', 'artifact-b', 'artifact-c'], categories: ['cafe', 'restaurant', 'park'], shown: ['cafe', 'restaurant'] })]);
    const dataset = await new OfflineDatasetBuilderService(source, 'artifact-salt').build(window);
    const strategies = await createOfflineEvaluator(source, RECOMMENDATION_CONFIG_DEV_V1).evaluate({ from: window.from, to: window.to, k: 5 });
    const directory = await mkdtemp(join(tmpdir(), 'meetup-offline-artifact-'));
    try {
      const paths = await writeOfflineEvaluationArtifacts({ output: join(directory, 'dataset.ndjson'), rows: dataset.rows, manifest: dataset.manifest, report: { manifest: dataset.manifest, strategies, dataQuality: dataset.dataQuality } });
      const ndjson = (await readFile(paths.datasetPath, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
      const manifest = JSON.parse(await readFile(paths.manifestPath, 'utf8'));
      const report = JSON.parse(await readFile(paths.reportPath, 'utf8'));
      expect(ndjson).toHaveLength(dataset.manifest.rowCount);
      expect(manifest.contentSha256).toBe(dataset.manifest.contentSha256);
      expect(report.strategies.map((strategy: { strategy: string }) => strategy.strategy)).toEqual(['min-sum', 'min-max', 'fair-pareto-v1']);
      expect(JSON.stringify(ndjson)).not.toContain('artifact-a');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function fixedSource(runs: OfflineSourceRun[]): OfflineEvaluationSource & { readCompletedRuns: jest.Mock } { return { readCompletedRuns: jest.fn().mockResolvedValue(runs) }; }
function event(participantId: string | null, canonicalCandidateKey: string, eventType: OfflineSourceRun['feedback'][number]['eventType']) { return { eventId: `${participantId ?? 'group'}-${canonicalCandidateKey}-${eventType}`, participantId, canonicalCandidateKey, eventType }; }
function scenarioRun(input: { id?: string; participants?: string[]; categories?: string[]; shown?: string[]; feedback?: OfflineSourceRun['feedback']; requestedAt?: string; algorithmVersion?: string; configVersion?: string } ): OfflineSourceRun {
  const participants = input.participants ?? ['member-a']; const categories = input.categories ?? ['cafe', 'restaurant']; const shown = input.shown ?? categories;
  const candidates = categories.map((category, index) => ({ canonicalCandidateKey: category, sourceCategories: [category], rating0To5: 4.9 - index / 10, userRatingCount: 100 - index, finalRank: index + 1, groupUtility: .9 - index / 10, candidateLeastMiseryUtility: .8 - index / 10, avgEtaSeconds: 300 + index * 60, maxEtaSeconds: 360 + index * 60, etaRangeSeconds: 60, scheduledOpeningStatus: index === 0 ? 'UNKNOWN' : 'OPEN' }));
  return { id: input.id ?? 'run-main', requestedAt: new Date(input.requestedAt ?? '2026-01-15T00:00:00.000Z'), algorithmVersion: input.algorithmVersion ?? 'engine-v1', configVersion: input.configVersion ?? 'config-v1', featureSchemaVersion: 'feature-v1', rankingStrategy: 'fair-pareto-v1', randomSeed: 'fixed-seed', effectiveK: Math.min(2, candidates.length), routeElementCount: participants.length * candidates.length,
    candidates, memberFeatures: participants.flatMap((participant, participantIndex) => candidates.map((candidate, index) => ({ participantId: participant, canonicalCandidateKey: candidate.canonicalCandidateKey, etaSeconds: candidate.avgEtaSeconds + participantIndex * 15, distanceMeters: 500 + index * 100, staticDurationSeconds: candidate.avgEtaSeconds, travelUtility: .9 - index / 10, preferenceUtility: index === 1 ? .1 : .8, placeQualityUtility: .8, memberUtility: .8 - index / 10, rankingUtility: .8 - index / 10, missingFlags: index === 0 ? ['OPENING_UNKNOWN'] : [] }))),
    impressions: participants.flatMap((participant) => shown.map((canonicalCandidateKey, index) => ({ eventId: `shown-${participant}-${canonicalCandidateKey}`, participantId: participant, canonicalCandidateKey, rank: index + 1 }))), feedback: input.feedback ?? [event(null, shown[0]!, 'MEETUP_PLACE_SELECTED')] };
}
function row(impressionRank: number, label: 0 | 1 | 2 | 3): OfflineDatasetRow { return { runId: 'metric-run', canonicalCandidateKey: `candidate-${impressionRank}`, participantPseudonym: 'metric-member', recommendationTimestamp: '2026-01-01T00:00:00.000Z', algorithmVersion: 'engine-v1', configVersion: 'config-v1', featureSchemaVersion: 'feature-v1', rankingStrategy: 'fair-pareto-v1', groupSize: 2, category: 'cafe', impressionRank, originalRank: impressionRank, label, shown: true, rawEvents: {}, features: { etaSeconds: 100, distanceMeters: 100, staticDurationSeconds: null, travelUtility: .8, preferenceUtility: .8, placeQualityUtility: .8, memberUtility: .8, rankingUtility: .8, groupUtility: .8, leastMiseryUtility: .7, avgEtaSeconds: 100, maxEtaSeconds: 150, etaRangeSeconds: 50, candidateRating: 4, candidateRatingCount: 10, scheduledOpeningStatus: 'OPEN', missingFlags: [] } }; }
