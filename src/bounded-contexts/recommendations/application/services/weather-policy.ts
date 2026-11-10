import type { EligibleCandidate } from './candidate-filter';
import type {
  PlaceExposure,
  WeatherContextPort,
  WeatherForecast,
} from '../ports/weather-context.port';

export type WeatherPolicy = 'OFF' | 'WARN_ONLY' | 'FILTER_OUTDOOR';
export const WEATHER_POLICY_VERSION = 'weather-policy-v1';

export type WeatherEligibleCandidate = EligibleCandidate & {
  weatherExposure?: PlaceExposure;
  weatherEvidence?: WeatherForecast;
};

export interface WeatherPolicyOutcome {
  candidates: WeatherEligibleCandidate[];
  filtered: Array<{
    candidate: WeatherEligibleCandidate;
    reason: 'WEATHER_UNSUITABLE';
  }>;
  warnings: string[];
  effectivePolicy: WeatherPolicy;
}

/** Policy deliberately treats missing, provider-error and unknown exposure as retain. */
export async function applyWeatherPolicy(
  candidates: EligibleCandidate[],
  scheduledAt: Date,
  policy: WeatherPolicy,
  provider?: WeatherContextPort,
  threshold = 0.7,
): Promise<WeatherPolicyOutcome> {
  if (policy === 'OFF' || !provider) {
    return { candidates, filtered: [], warnings: [], effectivePolicy: 'OFF' };
  }
  const enriched = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const weatherEvidence = await provider.forecast({
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          scheduledAt,
        });
        return {
          ...candidate,
          weatherExposure: exposure(candidate),
          weatherEvidence,
        };
      } catch {
        return {
          ...candidate,
          weatherExposure: exposure(candidate),
          weatherEvidence: {
            availability: 'UNAVAILABLE' as const,
            provider: 'unavailable',
          },
        };
      }
    }),
  );
  if (policy === 'WARN_ONLY')
    return {
      candidates: enriched,
      filtered: [],
      warnings: weatherWarnings(enriched),
      effectivePolicy: policy,
    };
  const filtered = enriched.filter((candidate) =>
    isUnsuitableOutdoor(candidate, threshold),
  );
  const retained = enriched.filter(
    (candidate) => !isUnsuitableOutdoor(candidate, threshold),
  );
  if (!retained.length && enriched.length) {
    return {
      candidates: enriched,
      filtered: [],
      warnings: [...weatherWarnings(enriched), 'WEATHER_FILTER_RELAXED'],
      effectivePolicy: 'WARN_ONLY',
    };
  }
  return {
    candidates: retained,
    filtered: filtered.map((candidate) => ({
      candidate,
      reason: 'WEATHER_UNSUITABLE',
    })),
    warnings: weatherWarnings(enriched),
    effectivePolicy: policy,
  };
}

function exposure(candidate: EligibleCandidate): PlaceExposure {
  const types = candidate.providerTypes.map((type) => type.toLowerCase());
  if (types.includes('outdoor') || types.includes('park')) return 'OUTDOOR';
  if (types.includes('cafe') || types.includes('restaurant')) return 'INDOOR';
  return 'UNKNOWN';
}
function isUnsuitableOutdoor(
  candidate: WeatherEligibleCandidate,
  threshold: number,
) {
  return (
    candidate.weatherEvidence?.availability === 'AVAILABLE' &&
    candidate.weatherExposure === 'OUTDOOR' &&
    (candidate.weatherEvidence.severity ?? -1) >= threshold
  );
}
function weatherWarnings(candidates: WeatherEligibleCandidate[]) {
  return candidates.some(
    (candidate) => candidate.weatherEvidence?.availability !== 'AVAILABLE',
  )
    ? ['WEATHER_DATA_UNAVAILABLE']
    : [];
}
