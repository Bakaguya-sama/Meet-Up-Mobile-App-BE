import type { RecommendationPlaceSnapshot } from '../../domain/recommendation-run';
import type {
  AiExplanationCache,
  AiExplanationProvider,
} from '../ports/ai-explanation.port';
import { AiExplanationService } from './ai-explanation.service';

const place = {
  rank: 1,
  explanation: {
    summaryCode: 'FAIR_PARETO_RANKED',
    facts: [
      { key: 'avgEtaSeconds', value: 600, unit: 'SECOND', source: 'ROUTES' },
    ],
    warnings: [],
  },
} as RecommendationPlaceSnapshot;

describe('AiExplanationService', () => {
  const run = { id: 'run', configVersion: 'config-v1' };
  let cache: jest.Mocked<AiExplanationCache>;
  let provider: jest.Mocked<AiExplanationProvider>;

  beforeEach(() => {
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    provider = { generate: jest.fn() };
  });

  it('uses the same deterministic fallback while provider is disabled', async () => {
    const service = new AiExplanationService(provider, cache, {
      enabled: false,
      ttlSeconds: 86_400,
      model: 'gemini-2.5-flash-lite',
    });
    await expect(service.explain(run, place)).resolves.toEqual(
      await service.explain(run, place),
    );
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it.each([new Error('timeout'), new Error('network')])(
    'falls back on provider failure',
    async (error) => {
      provider.generate.mockRejectedValue(error);
      const service = new AiExplanationService(provider, cache, {
        enabled: true,
        ttlSeconds: 86_400,
        model: 'gemini-2.5-flash-lite',
      });
      await expect(service.explain(run, place)).resolves.toMatchObject({
        source: 'rule_fallback',
      });
    },
  );

  it('rejects unsupported facts and overlong output', async () => {
    const service = new AiExplanationService(provider, cache, {
      enabled: true,
      ttlSeconds: 86_400,
      model: 'gemini-2.5-flash-lite',
    });
    provider.generate
      .mockResolvedValueOnce({ text: 'claim', factKeys: ['coordinate'] })
      .mockResolvedValueOnce({
        text: 'x'.repeat(1501),
        factKeys: ['avgEtaSeconds'],
      });
    await expect(service.explain(run, place)).resolves.toMatchObject({
      source: 'rule_fallback',
    });
    await expect(service.explain(run, place)).resolves.toMatchObject({
      source: 'rule_fallback',
    });
  });

  it('rejects provider output that does not match the structured schema', async () => {
    provider.generate.mockResolvedValue({
      text: 42,
      factKeys: 'avgEtaSeconds',
    } as never);
    const service = new AiExplanationService(provider, cache, {
      enabled: true,
      ttlSeconds: 86_400,
      model: 'gemini-2.5-flash-lite',
    });
    await expect(service.explain(run, place)).resolves.toMatchObject({
      source: 'rule_fallback',
    });
  });

  it('caches only validated output and projects aggregate facts', async () => {
    provider.generate.mockResolvedValue({
      text: 'Average travel time is about 10 minutes.',
      factKeys: ['avgEtaSeconds'],
    });
    const service = new AiExplanationService(provider, cache, {
      enabled: true,
      ttlSeconds: 86_400,
      model: 'gemini-2.5-flash-lite',
    });
    await expect(service.explain(run, place)).resolves.toMatchObject({
      source: 'ai',
      factKeys: ['avgEtaSeconds'],
    });
    expect(cache.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      86_400,
    );
    expect(provider.generate.mock.calls[0]?.[0].userPrompt).not.toMatch(
      /latitude|longitude|memberFeatures|token|email/i,
    );
  });

  it('uses a valid cache hit without provider access and repairs corrupt cache entries', async () => {
    cache.get
      .mockResolvedValueOnce({ text: 'cached', factKeys: ['avgEtaSeconds'] })
      .mockResolvedValueOnce({ text: '', factKeys: ['unsupported'] });
    provider.generate.mockResolvedValue({
      text: 'fresh',
      factKeys: ['avgEtaSeconds'],
    });
    const service = new AiExplanationService(provider, cache, {
      enabled: true,
      ttlSeconds: 86_400,
      model: 'gemini-2.5-flash-lite',
    });
    await expect(service.explain(run, place)).resolves.toMatchObject({
      text: 'cached',
      source: 'ai',
    });
    expect(provider.generate).not.toHaveBeenCalled();
    await expect(service.explain(run, place)).resolves.toMatchObject({
      text: 'fresh',
      source: 'ai',
    });
    expect(cache.remove).toHaveBeenCalled();
    expect(provider.generate).toHaveBeenCalledTimes(1);
  });

  it('invalidates cache identity when config/model/prompt/schema versions change', async () => {
    provider.generate.mockResolvedValue({
      text: 'safe',
      factKeys: ['avgEtaSeconds'],
    });
    const first = new AiExplanationService(provider, cache, {
      enabled: true,
      ttlSeconds: 86_400,
      model: 'gemini-2.5-flash-lite',
      promptVersion: 'prompt-v1',
      schemaVersion: 'schema-v1',
    });
    const second = new AiExplanationService(provider, cache, {
      enabled: true,
      ttlSeconds: 86_400,
      model: 'gemini-2.5-flash-lite-v2',
      promptVersion: 'prompt-v2',
      schemaVersion: 'schema-v2',
    });
    await first.explain(run, place);
    await second.explain({ ...run, configVersion: 'config-v2' }, place);
    const keys = cache.get.mock.calls.map(([key]) => key);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('falls back without provider access when cache access fails', async () => {
    cache.get.mockRejectedValue(new Error('redis unavailable'));
    const service = new AiExplanationService(provider, cache, {
      enabled: true,
      ttlSeconds: 86_400,
      model: 'gemini-2.5-flash-lite',
    });
    await expect(service.explain(run, place)).resolves.toMatchObject({
      source: 'rule_fallback',
    });
    expect(provider.generate).not.toHaveBeenCalled();
  });
});
