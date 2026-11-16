import { GeminiAiExplanationAdapter } from './gemini-ai-explanation.adapter';

describe('GeminiAiExplanationAdapter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends only the supplied redacted prompt and parses structured JSON', async () => {
    const request = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({ text: 'safe', factKeys: ['rank'] }),
                },
              ],
            },
          },
        ],
      }),
    } as Response);
    const adapter = new GeminiAiExplanationAdapter(
      'secret-key',
      'gemini-2.5-flash-lite',
      100,
    );
    await expect(
      adapter.generate({
        systemInstruction: 'Use only supplied facts.',
        userPrompt: JSON.stringify({ rank: 1 }),
        allowedFactKeys: ['rank'],
      }),
    ).resolves.toEqual({ text: 'safe', factKeys: ['rank'] });
    const call = request.mock.calls[0];
    expect(String(call?.[0])).toContain('gemini-2.5-flash-lite');
    expect(JSON.stringify(call?.[1]?.body)).not.toMatch(
      /latitude|longitude|memberFeatures|email|displayName/i,
    );
  });

  it('retries once and then exposes invalid JSON to deterministic fallback caller', async () => {
    const request = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{invalid' }] } }],
      }),
    } as Response);
    const adapter = new GeminiAiExplanationAdapter(
      'secret-key',
      'gemini-2.5-flash-lite',
      100,
    );
    await expect(
      adapter.generate({
        systemInstruction: 'Use only supplied facts.',
        userPrompt: '{}',
        allowedFactKeys: ['rank'],
      }),
    ).rejects.toBeInstanceOf(SyntaxError);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('retries only once on HTTP failure', async () => {
    const request = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: false, status: 503 } as Response);
    const adapter = new GeminiAiExplanationAdapter(
      'secret-key',
      'gemini-2.5-flash-lite',
      100,
    );
    await expect(
      adapter.generate({
        systemInstruction: 'Use only supplied facts.',
        userPrompt: '{}',
        allowedFactKeys: ['rank'],
      }),
    ).rejects.toThrow('status 503');
    expect(request).toHaveBeenCalledTimes(2);
  });
});
