import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { argon2id, hash, verify } from 'argon2';
import type { PasswordHasher } from '../../application/ports/password-hasher.port';

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  private readonly dummyHash = this.hash(randomBytes(32).toString('hex'));

  hash(password: string): Promise<string> {
    return hash(password, {
      type: argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verify(
    passwordHash: string | null,
    password: string,
  ): Promise<boolean> {
    const result = await verify(
      passwordHash ?? (await this.dummyHash),
      password,
    );
    return passwordHash !== null && result;
  }
}
