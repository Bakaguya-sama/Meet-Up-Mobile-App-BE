import type { RecommendationRunResult } from '../../domain/recommendation-run';
import type { RetentionResult } from '../ports/recommendation-snapshot-retention.port';

export type RecommendationMetricName =
  | 'recommendation_run_success_total'
  | 'recommendation_run_failure_total'
  | 'recommendation_route_elements_total'
  | 'recommendation_route_complete_candidates_total'
  | 'recommendation_end_to_end_latency_ms'
  | 'recommendation_explanation_coverage_total'
  | 'recommendation_replay_consistency_total'
  | 'recommendation_stale_context_total'
  | 'recommendation_unauthorized_total'
  | 'recommendation_opening_unknown_total'
  | 'recommendation_traffic_fallback_total'
  | 'recommendation_weather_unavailable_total'
  | 'recommendation_weather_relaxed_total'
  | 'recommendation_closing_soon_penalty_total';

/** Framework-independent metric registry and structured-log policy. */
export class RecommendationObservabilityService {
  private readonly counters = new Map<string, number>();

  constructor(
    private readonly logSink: (line: string) => void = () => undefined,
  ) {}

  recordCompleted(run: RecommendationRunResult): void {
    const labels = versionLabels(run);
    this.increment('recommendation_run_success_total', labels);
    this.increment(
      'recommendation_route_elements_total',
      labels,
      run.routeElementCount ?? 0,
    );
    this.increment(
      'recommendation_route_complete_candidates_total',
      labels,
      run.places.length,
    );
    this.increment(
      'recommendation_end_to_end_latency_ms',
      labels,
      Math.max(
        0,
        (run.completedAt?.getTime() ?? Date.now()) - run.requestedAt.getTime(),
      ),
    );
    this.increment(
      'recommendation_explanation_coverage_total',
      labels,
      run.places.filter((item) => item.explanation.facts.length > 0).length,
    );
    this.increment(
      'recommendation_opening_unknown_total',
      labels,
      run.places.filter((item) => item.scheduledOpeningStatus === 'UNKNOWN')
        .length,
    );
    this.increment(
      'recommendation_traffic_fallback_total',
      labels,
      run.routingPreferenceRequested === 'TRAFFIC_AWARE' &&
        run.routingPreferenceEffective === 'TRAFFIC_UNAWARE'
        ? 1
        : 0,
    );
    this.increment(
      'recommendation_weather_unavailable_total',
      labels,
      run.places.filter(
        (item) =>
          item.weatherEvidence?.availability !== undefined &&
          item.weatherEvidence.availability !== 'AVAILABLE',
      ).length,
    );
    this.increment(
      'recommendation_weather_relaxed_total',
      labels,
      run.warnings.includes('WEATHER_FILTER_RELAXED') ? 1 : 0,
    );
    this.increment(
      'recommendation_closing_soon_penalty_total',
      labels,
      run.places.filter(
        (item) => (item.closingEvidence?.closingPenalty ?? 0) > 0,
      ).length,
    );
    this.log('recommendation_completed', {
      runId: run.id,
      ...labels,
      routeElementCount: run.routeElementCount,
    });
  }

  recordFailure(code: string, labels: Record<string, string> = {}): void {
    this.increment('recommendation_run_failure_total', { ...labels, code });
  }

  recordReplay(consistency: boolean): void {
    this.increment('recommendation_replay_consistency_total', {
      consistency: String(consistency),
    });
  }

  recordStaleOrUnauthorized(kind: 'stale' | 'unauthorized'): void {
    this.increment(
      kind === 'stale'
        ? 'recommendation_stale_context_total'
        : 'recommendation_unauthorized_total',
    );
  }

  recordRetention(result: RetentionResult, durationMs: number): void {
    const labels = {
      policyVersion: result.policyVersion,
      dryRun: String(result.dryRun),
    };
    this.increment(
      'recommendation_run_success_total',
      { ...labels, stage: 'retention' },
      result.deleted,
    );
    this.log('recommendation_retention', {
      ...labels,
      scanned: result.scanned,
      deleted: result.deleted,
      protected: result.protected,
      failed: result.failed,
      durationMs,
      oldestEligibleAgeMs: result.oldestEligibleAgeMs,
    });
  }

  snapshot(): ReadonlyMap<string, number> {
    return new Map(this.counters);
  }

  private increment(
    name: RecommendationMetricName,
    labels: Record<string, string> = {},
    value = 1,
  ): void {
    const key = `${name}|${JSON.stringify(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)))}`;
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  private log(event: string, fields: Record<string, unknown>): void {
    this.logSink(
      JSON.stringify({ event, ...(redact(fields) as Record<string, unknown>) }),
    );
  }
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        /token|secret|password|authorization|latitude|longitude|coordinate|matchedtags|memberfeature|requestbody|aipayload/i.test(
          key,
        )
          ? '[REDACTED]'
          : redact(child),
      ]),
    );
  }
  return value;
}

function versionLabels(run: RecommendationRunResult): Record<string, string> {
  return {
    provider: 'google',
    algorithmVersion: run.algorithmVersion,
    configVersion: run.configVersion,
    featureSchemaVersion: run.featureSchemaVersion,
    routingPreference: run.routingPreferenceEffective,
    weatherPolicy: run.weatherPolicyEffective,
  };
}
