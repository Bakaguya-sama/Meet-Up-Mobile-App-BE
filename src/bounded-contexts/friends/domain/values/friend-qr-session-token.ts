import { createHash, randomBytes } from 'node:crypto';

export class FriendQrSessionToken {
  private constructor(
    readonly rawToken: string,
    readonly tokenHash: string,
  ) {}

  static issue(): FriendQrSessionToken {
    const rawToken = randomBytes(32).toString('base64url');
    return new FriendQrSessionToken(rawToken, this.hash(rawToken));
  }

  static hash(rawToken: string): string {
    return createHash('sha256').update(rawToken, 'utf8').digest('hex');
  }
}
