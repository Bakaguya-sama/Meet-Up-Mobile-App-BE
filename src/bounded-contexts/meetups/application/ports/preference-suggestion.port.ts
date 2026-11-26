import type { PreferenceDraftState } from '../../domain/services/preference-draft';
export const PREFERENCE_SUGGESTION_PROVIDER = Symbol(
  'PREFERENCE_SUGGESTION_PROVIDER',
);
export interface PreferenceSuggestionInput {
  message?: string;
  audio?: { data: string; mimeType: string };
  state: PreferenceDraftState;
  tags: Array<{ id: number; code: string; displayName: string }>;
}
export type PreferenceProviderFailure =
  | 'timeout'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'provider_rejected'
  | 'blocked'
  | 'invalid_output';
export class PreferenceProviderError extends Error {
  constructor(readonly reason: PreferenceProviderFailure) {
    super(reason);
  }
}
export interface PreferenceSuggestionProvider {
  /** Application validates untrusted JSON independently of the provider's schema feature. */
  suggest(input: PreferenceSuggestionInput): Promise<unknown>;
}
