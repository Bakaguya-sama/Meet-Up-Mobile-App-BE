import type {
  PreferenceSuggestion,
  PreferenceSuggestionInput,
  PreferenceSuggestionProvider,
} from '../../application/ports/preference-suggestion.port';

export class GeminiPreferenceSuggestionAdapter implements PreferenceSuggestionProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs = 8_000,
  ) {}

  async suggest(
    input: PreferenceSuggestionInput,
  ): Promise<PreferenceSuggestion> {
    const parts: Array<Record<string, unknown>> = [];
    if (input.message) parts.push({ text: `Tin nhắn mới: ${input.message}` });
    if (input.conversation?.length) {
      parts.push({
        text: `Lịch sử hội thoại JSON: ${JSON.stringify(input.conversation)}`,
      });
    }
    if (input.audio) {
      parts.push({
        inlineData: { mimeType: input.audio.mimeType, data: input.audio.data },
      });
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: [
                  'Bạn là trợ lý hỏi sở thích đi chơi cho một meetup tại Thành phố Hồ Chí Minh.',
                  'Chỉ trích xuất sở thích hoạt động và ngân sách tổng một người bằng VND từ lời người dùng.',
                  'Danh sách tag được cung cấp là nguồn duy nhất cho activityTagId; không tự tạo tag.',
                  'Nếu chưa đủ thông tin để chọn hoạt động hoặc mức chi, hãy hỏi tối đa một câu ngắn ở replyText và trả status clarification.',
                  'Khi đủ thông tin, trả status proposal để người dùng xem và xác nhận. Không tự lưu dữ liệu.',
                  'Không suy đoán thông tin nhạy cảm. Không có ngân sách thì budgetVnd là null.',
                  'Chỉ trả JSON đúng schema.',
                ].join(' '),
              },
            ],
          },
          contents: [
            {
              role: 'user',
              parts: [
                { text: `Activity tags hợp lệ: ${JSON.stringify(input.tags)}` },
                ...parts,
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 700,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                status: { type: 'STRING', enum: ['clarification', 'proposal'] },
                replyText: { type: 'STRING' },
                preferences: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      activityTagId: { type: 'INTEGER' },
                      level: {
                        type: 'STRING',
                        enum: ['high', 'normal', 'avoid'],
                      },
                    },
                    required: ['activityTagId', 'level'],
                  },
                },
                budgetVnd: { type: 'INTEGER', nullable: true },
              },
              required: ['status', 'replyText', 'preferences', 'budgetVnd'],
            },
          },
        }),
      },
    );
    if (!response.ok)
      throw new Error(`Gemini request failed: ${response.status}`);
    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const json = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!json)
      throw new Error('Gemini returned an empty preference suggestion');
    const result = JSON.parse(json) as PreferenceSuggestion;
    if (
      !['clarification', 'proposal'].includes(result.status) ||
      typeof result.replyText !== 'string' ||
      !Array.isArray(result.preferences) ||
      !(result.budgetVnd === null || typeof result.budgetVnd === 'number')
    )
      throw new Error('Gemini preference suggestion schema is invalid');
    return result;
  }
}
