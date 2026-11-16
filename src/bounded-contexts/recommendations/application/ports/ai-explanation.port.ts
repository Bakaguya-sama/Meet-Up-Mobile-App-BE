export interface AiExplanationValue {
  text: string;
  factKeys: string[];
}

/** A reviewed, redacted prompt assembled by the application layer. */
export interface AiExplanationPrompt {
  systemInstruction: string;
  userPrompt: string;
  allowedFactKeys: string[];
}

export const AI_EXPLANATION_PROVIDER = Symbol('AI_EXPLANATION_PROVIDER');
export interface AiExplanationProvider {
  generate(input: AiExplanationPrompt): Promise<AiExplanationValue>;
}

export const AI_EXPLANATION_CACHE = Symbol('AI_EXPLANATION_CACHE');
export interface AiExplanationCache {
  get(key: string): Promise<AiExplanationValue | null>;
  set(
    key: string,
    value: AiExplanationValue,
    ttlSeconds: number,
  ): Promise<void>;
  remove(key: string): Promise<void>;
}
