import { RECOMMENDATION_CONFIG_DEV_V1 } from '../recommendation-config';
import type { MemberFeature } from './member-utility.service';
import { GroupRankerService } from './group-ranker.service';

function feature(
  candidate: string,
  member: string,
  eta: number,
  utility: number,
) {
  return {
    participantId: member,
    canonicalCandidateKey: candidate,
    etaSeconds: eta,
    distanceMeters: eta,
    placeTags: [],
    preferences: [],
    rating0To5: null,
    userRatingCount: null,
    matchedTags: [],
    missingFlags: [],
    travelUtility: utility,
    preferenceUtility: utility,
    placeQualityUtility: utility,
    memberUtility: utility,
  } satisfies MemberFeature;
}

describe('GroupRankerService', () => {
  const features = [
    feature('a', 'm1', 100, 0.9),
    feature('a', 'm2', 500, 0.2),
    feature('b', 'm1', 300, 0.7),
    feature('b', 'm2', 300, 0.7),
    feature('c', 'm1', 600, 0.1),
    feature('c', 'm2', 600, 0.1),
  ];
  const ranker = new GroupRankerService(RECOMMENDATION_CONFIG_DEV_V1);

  it('matches hand-computed min-sum, min-max and Pareto dominance', () => {
    expect(
      ranker
        .rank(features, 'min-sum', 2, 'seed')
        .map((x) => x.canonicalCandidateKey),
    ).toEqual(['a', 'b', 'c']);
    const minMax = ranker.rank(features, 'min-max', 2, 'seed');
    expect(minMax.map((x) => x.canonicalCandidateKey)).toEqual(['b', 'a', 'c']);
    expect(
      minMax.find((x) => x.canonicalCandidateKey === 'c')?.paretoLevel,
    ).toBe(3);
    expect(minMax.find((x) => x.canonicalCandidateKey === 'b')).toMatchObject({
      groupUtility: 0.7,
      leastMiseryUtility: 0.7,
      avgEtaSeconds: 300,
      maxEtaSeconds: 300,
    });
  });

  it('replays a deterministic full fair-pareto rank from the same seed', () => {
    const first = ranker.rank(features, 'fair-pareto-v1', 2, 'stable-seed');
    const second = ranker.rank(features, 'fair-pareto-v1', 2, 'stable-seed');
    expect(second).toEqual(first);
    expect(first.map((x) => x.finalRank)).toEqual([1, 2, 3]);
    expect(first.every((x) => Number.isFinite(x.groupUtility))).toBe(true);
  });

  it('uses canonical key as the final deterministic tie-breaker', () => {
    const tied = [feature('z', 'm1', 100, 0.5), feature('a', 'm1', 100, 0.5)];
    expect(
      ranker
        .rank(tied, 'fair-pareto-v1', 1, 'seed')
        .map((x) => x.canonicalCandidateKey),
    ).toEqual(['a', 'z']);
  });

  it('lowers a closing-soon candidate in every utility-based ranking strategy', () => {
    const closingSoon = feature('closing-soon', 'm1', 300, 0.8);
    const openLonger = feature('open-longer', 'm1', 300, 0.8);
    closingSoon.rankingUtility = 0.65;
    openLonger.rankingUtility = 0.8;

    for (const strategy of ['min-sum', 'min-max', 'fair-pareto-v1'] as const) {
      expect(
        ranker.rank([closingSoon, openLonger], strategy, 1, 'seed')[0],
      ).toMatchObject({ canonicalCandidateKey: 'open-longer' });
    }
  });
});
