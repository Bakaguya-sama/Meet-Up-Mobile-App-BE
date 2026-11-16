import type {
  AiExplanationPrompt,
  AiExplanationProvider,
  AiExplanationValue,
} from '../../application/ports/ai-explanation.port';

export class GeminiAiExplanationAdapter implements AiExplanationProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs = 5_000,
  ) {}
  async generate(input: AiExplanationPrompt): Promise<AiExplanationValue> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'content-type': 'application/json',
              'x-goog-api-key': this.apiKey,
            },
            body: JSON.stringify({
              systemInstruction: {
                parts: [
                  {
                    text: input.systemInstruction,
                  },
                ],
              },
              contents: [{ role: 'user', parts: [{ text: input.userPrompt }] }],
              generationConfig: {
                temperature: 0,
                maxOutputTokens: 512,
                responseMimeType: 'application/json',
                responseSchema: {
                  type: 'OBJECT',
                  properties: {
                    text: { type: 'STRING' },
                    factKeys: {
                      type: 'ARRAY',
                      items: { type: 'STRING', enum: input.allowedFactKeys },
                    },
                  },
                  required: ['text', 'factKeys'],
                },
              },
            }),
          },
        );
        if (!response.ok)
          throw new Error(
            `Gemini request failed with status ${response.status}`,
          );
        const body = (await response.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Gemini response is empty');
        return JSON.parse(text) as AiExplanationValue;
      } catch (error) {
        lastError = error;
        if (attempt === 0)
          await new Promise((resolve) =>
            setTimeout(resolve, 100 * 2 ** attempt),
          );
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  }
}
