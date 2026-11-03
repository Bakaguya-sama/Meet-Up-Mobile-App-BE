import { createHash, randomBytes } from 'node:crypto';

export interface IssuedMeetupInviteToken {
  rawToken: string;
  tokenHash: string;
}

/** Raw invite secrets are generated at the boundary and never kept in domain state. */
export class MeetupInviteLinkToken {
  static issue(): IssuedMeetupInviteToken {
    const rawToken = randomBytes(32).toString('base64url');
    return { rawToken, tokenHash: this.hash(rawToken) };
  }

  static hash(rawToken: string): string {
    return createHash('sha256').update(rawToken, 'utf8').digest('hex');
  }

  static isWellFormed(rawToken: string): boolean {
    return /^[A-Za-z0-9_-]{43}$/.test(rawToken);
  }
}
