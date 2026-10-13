export const PRESENCE = Symbol('PRESENCE');

export interface PresencePort {
  connect(userId: string, connectionId: string): Promise<void>;
  refresh(userId: string, connectionId: string): Promise<void>;
  disconnect(userId: string, connectionId: string): Promise<void>;
  isOnline(userId: string): Promise<boolean>;
}
