import type { NormalizedOpeningHours } from '../ports/place-search.port';
import type {
  ClosingEvidence,
  ScheduledOpeningEvidence,
  ScheduledOpeningStatus,
} from '../../domain/temporal-context';

export interface RawCandidate {
  provider: string;
  providerPlaceId: string;
  name: string;
  latitude: number;
  longitude: number;
  providerTypes: string[];
  sourceCategory: string;
  sourcePage: number;
  businessStatus?:
    'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' | 'UNKNOWN';
  rating0To5?: number;
  userRatingCount?: number;
  currentOpen?: boolean;
  currentOpeningHours?: NormalizedOpeningHours;
  regularOpeningHours?: NormalizedOpeningHours;
  timeZoneId?: string;
  utcOffsetMinutes?: number;
}

export interface EligibleCandidate extends RawCandidate {
  canonicalCandidateKey: string;
  distanceFromSearchCenterMeters: number;
  matchedRequiredCategories: string[];
  sourceCategories: string[];
  sourcePages: number[];
  normalizedTags: string[];
  scheduledOpeningStatus?: ScheduledOpeningStatus;
  openingEvidence?: ScheduledOpeningEvidence;
  closingEvidence?: ClosingEvidence;
}

export interface FilteredCandidateAudit {
  candidate: EligibleCandidate;
  reason: 'CLOSED_PERMANENTLY' | 'OUTSIDE_RADIUS' | 'CATEGORY_MISMATCH';
}

export interface CandidateFilterOutcome {
  eligible: EligibleCandidate[];
  filtered: FilteredCandidateAudit[];
}

export function filterCandidates(
  input: RawCandidate[],
  center: { latitude: number; longitude: number },
  radiusMeters: number,
  categories: string[],
): EligibleCandidate[] {
  return filterCandidatesWithAudit(input, center, radiusMeters, categories)
    .eligible;
}

export function filterCandidatesWithAudit(
  input: RawCandidate[],
  center: { latitude: number; longitude: number },
  radiusMeters: number,
  categories: string[],
): CandidateFilterOutcome {
  const merged = new Map<
    string,
    RawCandidate & {
      matched: Set<string>;
      sources: Set<string>;
      pages: Set<number>;
    }
  >();
  for (const item of input) {
    if (
      !item.providerPlaceId ||
      !Number.isFinite(item.latitude) ||
      !Number.isFinite(item.longitude)
    )
      continue;
    const key = `${item.provider}:${item.providerPlaceId}`;
    const current = merged.get(key) ?? {
      ...item,
      matched: new Set<string>(),
      sources: new Set<string>(),
      pages: new Set<number>(),
    };
    if (categories.includes(item.sourceCategory))
      current.matched.add(item.sourceCategory);
    current.sources.add(item.sourceCategory);
    current.pages.add(item.sourcePage);
    merged.set(key, current);
  }
  const normalized = [...merged.entries()]
    .map(([canonicalCandidateKey, item]) => ({
      ...item,
      canonicalCandidateKey,
      distanceFromSearchCenterMeters: haversine(center, item),
      matchedRequiredCategories: [...item.matched].sort(),
      sourceCategories: [...item.sources].sort(),
      sourcePages: [...item.pages].sort((a, b) => a - b),
      normalizedTags: [...item.sources].sort(),
    }))
    .sort((a, b) =>
      a.canonicalCandidateKey.localeCompare(b.canonicalCandidateKey),
    );
  const eligible: EligibleCandidate[] = [];
  const filtered: FilteredCandidateAudit[] = [];
  for (const candidate of normalized) {
    const reason =
      candidate.businessStatus === 'CLOSED_PERMANENTLY'
        ? 'CLOSED_PERMANENTLY'
        : candidate.distanceFromSearchCenterMeters > radiusMeters
          ? 'OUTSIDE_RADIUS'
          : candidate.matchedRequiredCategories.length === 0
            ? 'CATEGORY_MISMATCH'
            : null;
    if (reason) filtered.push({ candidate, reason });
    else eligible.push(candidate);
  }
  return { eligible, filtered };
}

function haversine(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dLon / 2) ** 2;
  return (
    2 *
    6_371_000 *
    Math.atan2(
      Math.sqrt(Math.min(1, Math.max(0, value))),
      Math.sqrt(1 - Math.min(1, Math.max(0, value))),
    )
  );
}
