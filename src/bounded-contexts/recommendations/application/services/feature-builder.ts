import { RecommendationError } from '../../domain/recommendation.error';
import type { EligibleCandidate } from './candidate-filter';
import type { MemberFeatureInput } from './member-utility.service';
import type { RoutableCandidate } from './route-matrix.service';

export interface FeatureMember {
  participantId: string;
  preferences: Array<{ tagCode: string; level: 'high' | 'normal' | 'avoid' }>;
}

export class FeatureBuilder {
  readonly schemaVersion = 'recommendation-features-v1';

  build(
    members: FeatureMember[],
    candidates: EligibleCandidate[],
    routableCandidates: RoutableCandidate[],
  ): MemberFeatureInput[] {
    const memberById = new Map(
      members.map((member) => [member.participantId, member]),
    );
    const candidateByKey = new Map(
      candidates.map((candidate) => [
        candidate.canonicalCandidateKey,
        candidate,
      ]),
    );
    return routableCandidates.flatMap((routable) => {
      const candidate = candidateByKey.get(routable.canonicalCandidateKey);
      if (!candidate) invalidFeature();
      return routable.routes.map((route) => {
        const member = memberById.get(route.participantId);
        if (!member) invalidFeature();
        return {
          participantId: route.participantId,
          canonicalCandidateKey: route.canonicalCandidateKey,
          etaSeconds: route.etaSeconds,
          distanceMeters: route.distanceMeters,
          placeTags: [...candidate.normalizedTags],
          preferences: member.preferences.map((value) => ({ ...value })),
          rating0To5: candidate.rating0To5 ?? null,
          userRatingCount: candidate.userRatingCount ?? null,
        };
      });
    });
  }
}

function invalidFeature(): never {
  throw new RecommendationError(
    'INVALID_RECOMMENDATION_NUMERIC',
    'Feature input does not match the validated route matrix',
  );
}
