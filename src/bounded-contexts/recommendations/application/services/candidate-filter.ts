import type { NormalizedOpeningHours } from '../ports/place-search.port';
import type {
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
}

export function filterCandidates(
  input: RawCandidate[],
  center: { latitude: number; longitude: number },
  radiusMeters: number,
  categories: string[],
): EligibleCandidate[] {
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
  return [...merged.entries()]
    .map(([canonicalCandidateKey, item]) => ({
      ...item,
      canonicalCandidateKey,
      distanceFromSearchCenterMeters: haversine(center, item),
      matchedRequiredCategories: [...item.matched].sort(),
      sourceCategories: [...item.sources].sort(),
      sourcePages: [...item.pages].sort((a, b) => a - b),
      normalizedTags: [...item.sources].sort(),
    }))
    .filter(
      (item) =>
        item.businessStatus !== 'CLOSED_PERMANENTLY' &&
        item.distanceFromSearchCenterMeters <= radiusMeters &&
        item.matchedRequiredCategories.length > 0,
    )
    .sort((a, b) =>
      a.canonicalCandidateKey.localeCompare(b.canonicalCandidateKey),
    );
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
