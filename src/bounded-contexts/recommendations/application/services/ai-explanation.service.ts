import { createHash } from 'node:crypto';
import type {
  RecommendationExplanation,
  RecommendationPlaceSnapshot,
} from '../../domain/recommendation-run';
import type {
  AiExplanationCache,
  AiExplanationProvider,
  AiExplanationValue,
} from '../ports/ai-explanation.port';
import { AiExplanationPromptBuilder } from './ai-explanation-prompt.builder';

export class AiExplanationService {
  constructor(
    private readonly provider: AiExplanationProvider,
    private readonly cache: AiExplanationCache,
    private readonly options: {
      enabled: boolean;
      ttlSeconds: number;
      model: string;
      provider?: string;
      promptVersion?: string;
      schemaVersion?: string;
    },
    private readonly prompts = new AiExplanationPromptBuilder(),
  ) {}

  async explain(
    run: { id: string; configVersion: string },
    place: RecommendationPlaceSnapshot,
  ) {
    const facts = place.explanation.facts.map(
      ({ key, value, unit, source }) => ({ key, value, unit, source }),
    );
    const key = createHash('sha256')
      .update(
        JSON.stringify({
          runId: run.id,
          configVersion: run.configVersion,
          provider: this.options.provider ?? 'google-gemini',
          model: this.options.model,
          promptVersion: this.options.promptVersion ?? 'ai-explanation-v1',
          schemaVersion: this.options.schemaVersion ?? 'ai-explanation-v1',
          explanation: place.explanation,
        }),
      )
      .digest('hex');
    const fallback = deterministicFallback(place.explanation);
    let cached: AiExplanationValue | null = null;
    try {
      cached = await this.cache.get(key);
    } catch {
      return { ...fallback, source: 'rule_fallback' as const };
    }
    if (cached && valid(cached, facts))
      return { ...cached, source: 'ai' as const };
    if (cached) await this.cache.remove(key).catch(() => undefined);
    if (!this.options.enabled)
      return { ...fallback, source: 'rule_fallback' as const };
    try {
      const value = await this.provider.generate(
        this.prompts.build({
          rank: place.rank,
          summaryCode: place.explanation.summaryCode,
          facts,
          warnings: place.explanation.warnings,
        }),
      );
      if (!valid(value, facts))
        return { ...fallback, source: 'rule_fallback' as const };
      await this.cache.set(key, value, this.options.ttlSeconds);
      return { ...value, source: 'ai' as const };
    } catch {
      return { ...fallback, source: 'rule_fallback' as const };
    }
  }
}

function valid(value: AiExplanationValue, facts: Array<{ key: string }>) {
  return (
    typeof value.text === 'string' &&
    value.text.length > 0 &&
    value.text.length <= 1500 &&
    Array.isArray(value.factKeys) &&
    value.factKeys.every((key) => facts.some((fact) => fact.key === key))
  );
}

function deterministicFallback(explanation: RecommendationExplanation) {
  return {
    text: `${explanation.summaryCode}: ${explanation.facts.map((fact) => `${fact.key}=${fact.value}`).join(', ')}`,
    factKeys: explanation.facts.map((fact) => fact.key),
  };
}
