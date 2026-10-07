export interface SessionState {
  id: string;
  userAccountId: string;
  refreshTokenHash: string;
  refreshTokenFamilyId: string;
  parentSessionId: string | null;
  replacedBySessionId: string | null;
  deviceName: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  reuseDetectedAt: Date | null;
  createdAt: Date;
}

export class UserSession {
  constructor(private readonly state: SessionState) {}

  isActive(now: Date): boolean {
    return !this.state.revokedAt && this.state.expiresAt > now;
  }

  wasRevoked(): boolean {
    return this.state.revokedAt !== null;
  }

  replaceWith(id: string, now: Date): void {
    this.state.revokedAt = now;
    this.state.replacedBySessionId = id;
  }

  detectReuse(now: Date): void {
    this.state.reuseDetectedAt = now;
  }

  snapshot(): SessionState {
    return { ...this.state };
  }
}
