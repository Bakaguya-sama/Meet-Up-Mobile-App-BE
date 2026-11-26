export const PREFERENCE_AUDIO = Symbol('PREFERENCE_AUDIO');
export interface PreferenceAudioPort {
  validate(audio: {
    data: string;
    mimeType: string;
  }): Promise<{ data: string; mimeType: string }>;
}
