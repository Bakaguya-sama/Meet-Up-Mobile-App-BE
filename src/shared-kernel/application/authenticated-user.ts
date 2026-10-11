export type ApplicationRole = 'user' | 'admin';

/**
 * Identity made available to HTTP and realtime transports after authentication.
 * It intentionally contains no persistence or framework type.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  sessionId: string;
  roles: readonly ApplicationRole[];
}
