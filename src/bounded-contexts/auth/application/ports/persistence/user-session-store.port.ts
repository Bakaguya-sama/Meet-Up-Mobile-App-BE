import type { UserSession } from '../../../domain/aggregates/user-session.aggregate';

export interface UserSessionStorePort {
  findSession(id: string): Promise<UserSession | null>;
  saveSession(session: UserSession): Promise<void>;
  revokeFamily(familyId: string, now: Date): Promise<void>;
}
