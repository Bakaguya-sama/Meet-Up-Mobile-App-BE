export const PREFERENCE_SUGGESTION_TELEMETRY = Symbol(
  'PREFERENCE_SUGGESTION_TELEMETRY',
);

export interface PreferenceSuggestionTelemetryPort {
  recordSuggestion(input: {
    suggestionId: string;
    usedAi: boolean;
    outcome: 'proposal' | 'clarification' | 'manual_fallback';
    suggestedTagIds: number[];
    durationMs: number;
  }): void;
  recordConfirmation(input: {
    suggestionId?: string;
    usedAi: boolean;
    finalTagIds: number[];
  }): void;
}
