import type { PreferenceDraftState } from '../../domain/services/preference-draft';

export const PREFERENCE_DRAFT_STORE = Symbol('PREFERENCE_DRAFT_STORE');
export interface PreferenceDraftSession {
  id: string;
  actorId: string;
  meetupId: string;
  createdAt: number;
  expiresAt: number;
  revision: number;
  turns: number;
  clarifications: number;
  baseVersion: string;
  profileVersion: string;
  taxonomyVersion: string;
  mode: 'clarification' | 'proposal' | 'manual_fallback' | 'consumed';
  draft: PreferenceDraftState;
}
export interface PreferenceDraftStore {
  load(id: string): Promise<PreferenceDraftSession | null>;
  acquire(id: string): Promise<string | null>;
  save(session: PreferenceDraftSession, lease: string): Promise<void>;
  release(id: string, lease: string): Promise<void>;
  /** Atomically checks ownership, revision, proposal, expiry and active lease, then consumes once. */
  consume(
    id: string,
    actorId: string,
    meetupId: string,
    revision: number,
  ): Promise<PreferenceDraftSession | null>;
  allowRequest(actorId: string): Promise<boolean>;
}
