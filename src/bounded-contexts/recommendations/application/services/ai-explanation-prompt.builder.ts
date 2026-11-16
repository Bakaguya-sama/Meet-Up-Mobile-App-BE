import type { AiExplanationPrompt } from '../ports/ai-explanation.port';

export const AI_EXPLANATION_PROMPT_VERSIONS = ['v1'] as const;
export type AiExplanationPromptVersion =
  (typeof AI_EXPLANATION_PROMPT_VERSIONS)[number];

export interface AiExplanationPromptFacts {
  rank: number;
  summaryCode: string;
  facts: Array<{
    key: string;
    value: string | number;
    unit?: string;
    source: string;
  }>;
  warnings: string[];
}

/**
 * Builds reviewed, versioned Gemini input from already-redacted aggregate facts.
 * Configuration selects a version; it never injects arbitrary prompt text.
 */
export class AiExplanationPromptBuilder {
  constructor(private readonly version: AiExplanationPromptVersion = 'v1') {}

  build(input: AiExplanationPromptFacts): AiExplanationPrompt {
    const allowedFactKeys = input.facts.map((fact) => fact.key);
    return {
      systemInstruction: systemInstructionFor(this.version),
      userPrompt: JSON.stringify({
        promptVersion: this.version,
        rank: input.rank,
        summaryCode: input.summaryCode,
        facts: input.facts,
        warnings: input.warnings,
      }),
      allowedFactKeys,
    };
  }
}

function systemInstructionFor(version: AiExplanationPromptVersion): string {
  switch (version) {
    case 'v1':
      return [
        'You are a recommendation explanation formatter.',
        'Write only from the supplied structured facts and warnings.',
        'Do not add people, locations, scores, estimates, claims, or facts absent from the input.',
        'Return JSON with text and factKeys; factKeys must identify every supplied fact used.',
      ].join(' ');
  }
}
