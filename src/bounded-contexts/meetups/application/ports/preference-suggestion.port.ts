import type { PreferenceLevel } from '../../domain/aggregates/meetup.aggregate';

export const PREFERENCE_SUGGESTION_PROVIDER = Symbol(
  'PREFERENCE_SUGGESTION_PROVIDER',
);

export interface PreferenceConversationTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface PreferenceSuggestionTag {
  activityTagId: number;
  level: PreferenceLevel;
}

export interface PreferenceSuggestionInput {
  message?: string;
  conversation?: PreferenceConversationTurn[];
  audio?: { data: string; mimeType: string };
  tags: Array<{ id: number; code: string; displayName: string }>;
}

export interface PreferenceSuggestion {
  status: 'clarification' | 'proposal';
  replyText: string;
  preferences: PreferenceSuggestionTag[];
  budgetVnd: number | null;
}

export interface PreferenceSuggestionProvider {
  suggest(input: PreferenceSuggestionInput): Promise<PreferenceSuggestion>;
}
