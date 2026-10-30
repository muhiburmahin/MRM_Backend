import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

@Injectable()
export class PasswordService {
  // argon2id, ~19 MiB, 2 passes, 1 lane (OWASP-recommended minimum profile). Tune on real hardware.
  private readonly options = {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  } as const;

  private dummyHash?: Promise<string>;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /** Burn comparable CPU time when the account does not exist (reduces user-enumeration timing signal). */
  async verifyDummy(plain: string): Promise<void> {
    this.dummyHash ??= this.hash('dummy-password-for-timing-equalisation');
    await this.verify(await this.dummyHash, plain);
  }

  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, this.options);
    } catch {
      return false;
    }
  }

  /** Returns a list of human-readable problems (empty = OK). */
  validatePolicy(plain: string, ctx: { email?: string } = {}): string[] {
    const problems: string[] = [];
    if (plain.length < PASSWORD_MIN_LENGTH) problems.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
    if (plain.length > PASSWORD_MAX_LENGTH) problems.push(`Password must be at most ${PASSWORD_MAX_LENGTH} characters long`);
    if (/^(.)\1+$/.test(plain)) problems.push('Password must not be a single repeated character');
    const local = ctx.email?.split('@')[0]?.toLowerCase();
    if (local && local.length >= 4 && plain.toLowerCase().includes(local)) {
      problems.push('Password must not contain your email name');
    }
    return problems;
  }
}
