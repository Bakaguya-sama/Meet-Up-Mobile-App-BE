import { randomBytes } from 'node:crypto';
import { AuthError } from '../errors/auth.error';

const PUBLIC_HANDLE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Opaque, non-identifying handle used to resolve a stable profile QR. */
export class PublicHandle {
  private constructor(readonly value: string) {}

  static generate(): PublicHandle {
    return new PublicHandle(randomBytes(32).toString('base64url'));
  }

  static from(value: string): PublicHandle {
    if (!PUBLIC_HANDLE_PATTERN.test(value)) {
      throw new AuthError('INVALID_INPUT', 'Invalid public handle');
    }
    return new PublicHandle(value);
  }
}
