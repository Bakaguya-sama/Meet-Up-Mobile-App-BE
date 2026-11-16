import { AiExplanationPromptBuilder } from './ai-explanation-prompt.builder';

describe('AiExplanationPromptBuilder', () => {
  it('builds a versioned structured prompt from aggregate facts only', () => {
    const prompt = new AiExplanationPromptBuilder('v1').build({
      rank: 1,
      summaryCode: 'FAIR_PARETO_RANKED',
      facts: [
        { key: 'avgEtaSeconds', value: 600, unit: 'SECOND', source: 'ROUTES' },
      ],
      warnings: ['OPENING_UNKNOWN'],
    });

    expect(prompt.systemInstruction).toContain('supplied structured facts');
    expect(prompt.allowedFactKeys).toEqual(['avgEtaSeconds']);
    expect(prompt.userPrompt).toContain('"promptVersion":"v1"');
    expect(prompt.userPrompt).not.toMatch(
      /latitude|longitude|memberFeatures|token/i,
    );
  });
});
