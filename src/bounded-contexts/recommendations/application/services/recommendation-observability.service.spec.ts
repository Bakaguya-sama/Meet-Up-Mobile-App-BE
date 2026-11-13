import {
  RecommendationObservabilityService,
  redact,
} from './recommendation-observability.service';

describe('RecommendationObservabilityService', () => {
  it('redacts credentials, exact coordinates and raw feature/provider payloads recursively', () => {
    expect(
      redact({
        token: 'raw-token',
        latitude: 10.7,
        nested: { longitude: 106.7, rawAiPayload: { text: 'secret' } },
        memberFeature: { matchedTags: ['private'] },
      }),
    ).toEqual({
      token: '[REDACTED]',
      latitude: '[REDACTED]',
      nested: { longitude: '[REDACTED]', rawAiPayload: '[REDACTED]' },
      memberFeature: '[REDACTED]',
    });
  });

  it('records replay consistency and redacted retention audit fields', () => {
    const lines: string[] = [];
    const service = new RecommendationObservabilityService((line) =>
      lines.push(line),
    );
    service.recordReplay(true);
    service.recordRetention(
      {
        policyVersion: 'q13-v1',
        scanned: 5,
        eligible: 3,
        deleted: 3,
        protected: 2,
        failed: 0,
        dryRun: false,
        oldestEligibleAgeMs: 1000,
      },
      50,
    );
    expect(
      [...service.snapshot().entries()].some(([key]) =>
        key.startsWith('recommendation_replay_consistency_total'),
      ),
    ).toBe(true);
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toMatch(/latitude|longitude|token|secret/i);
  });
});
