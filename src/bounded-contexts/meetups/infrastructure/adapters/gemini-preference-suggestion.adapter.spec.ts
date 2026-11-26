import { GeminiPreferenceSuggestionAdapter } from './gemini-preference-suggestion.adapter';
import type { PreferenceSuggestionInput } from '../../application/ports/preference-suggestion.port';

const input: PreferenceSuggestionInput = {
  message: 'cà phê',
  tags: [{ id: 1, code: 'coffee', displayName: 'Cà phê' }],
  state: {
    preferences: [],
    effectivePreferences: [],
    budgetVnd: null,
    budgetAction: 'keep',
    pendingBudgetQuestion: 'none',
    hasChanges: false,
    question: 'activity',
  },
};
const output = {
  preferences: [],
  budget: { action: 'keep', amountVnd: null, evidence: '' },
  clarification: 'activity',
  transcript: null,
};
const response = () =>
  new Response(
    JSON.stringify({
      candidates: [
        {
          finishReason: 'STOP',
          content: { parts: [{ text: JSON.stringify(output) }] },
        },
      ],
    }),
    { status: 200 },
  );

describe('Gemini preference provider resilience', () => {
  let request: jest.SpiedFunction<typeof fetch>;
  beforeEach(() => {
    request = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    request.mockRestore();
  });
  it('retries one transient response under a shared deadline', async () => {
    request
      .mockResolvedValueOnce(
        new Response('', { status: 503, headers: { 'retry-after': '0' } }),
      )
      .mockResolvedValueOnce(response());
    await expect(
      new GeminiPreferenceSuggestionAdapter('test-key', 'model').suggest(input),
    ).resolves.toEqual(output);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][1]?.signal).toBe(
      request.mock.calls[1][1]?.signal,
    );
  });
  it.each([
    [401, 'provider_rejected'],
    [429, 'rate_limited'],
  ] as const)(
    'does not retry %s with a long Retry-After',
    async (status, reason) => {
      request.mockResolvedValue(
        new Response('', { status, headers: { 'retry-after': '86400' } }),
      );
      await expect(
        new GeminiPreferenceSuggestionAdapter('test-key', 'model').suggest(
          input,
        ),
      ).rejects.toMatchObject({ reason });
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it('aborts a stalled request without leaking raw provider errors', async () => {
    request.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new Error('contains private provider details')),
            { once: true },
          );
        }),
    );
    await expect(
      new GeminiPreferenceSuggestionAdapter('test-key', 'model', 15).suggest(
        input,
      ),
    ).rejects.toMatchObject({ reason: 'timeout', message: 'timeout' });
  });
  it.each(['SAFETY', 'MAX_TOKENS'])(
    'rejects incomplete or blocked %s responses',
    async (finishReason) => {
      request.mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason,
                content: { parts: [{ text: JSON.stringify(output) }] },
              },
            ],
          }),
        ),
      );
      await expect(
        new GeminiPreferenceSuggestionAdapter('test-key', 'model').suggest(
          input,
        ),
      ).rejects.toMatchObject({
        reason: finishReason === 'SAFETY' ? 'blocked' : 'invalid_output',
      });
    },
  );
  it('puts credentials only in a header and passes server state without fabricated client turns', async () => {
    request.mockResolvedValue(response());
    await new GeminiPreferenceSuggestionAdapter('private-key', 'model').suggest(
      input,
    );
    const [url, config] = request.mock.calls[0];
    expect(typeof url).toBe('string');
    expect(url).not.toContain('private-key');
    expect(config?.headers).toHaveProperty('x-goog-api-key', 'private-key');
    const body = config?.body;
    expect(typeof body).toBe('string');
    expect(body).toContain('currentDraft');
    expect(body).not.toContain('conversation');
  });
});
