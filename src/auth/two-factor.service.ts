import { Inject, Injectable, Logger } from '@nestjs/common';
import crypto from 'node:crypto';
import { AuthConfig, authConfig } from './auth.config';

// RFC 4648 Base32 alphabet
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(str: string): Buffer {
  const cleaned = str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character: ${cleaned[i]}`);
    }
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

export interface TwoFactorTicketPayload {
  userId: string;
  email: string;
  exp: number;
}

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly encKey: Buffer;
  private readonly ticketKey: Buffer;

  constructor(@Inject(authConfig.KEY) private readonly cfg: AuthConfig) {
    const secretSource = process.env.AUTH_2FA_ENCRYPTION_KEY || cfg.ipHashSalt;
    // Derive a fixed 32-byte AES key for TOTP secrets
    this.encKey = Buffer.from(
      crypto.hkdfSync(
        'sha256',
        Buffer.from(secretSource, 'utf8'),
        Buffer.from('mrm-2fa-salt', 'utf8'),
        Buffer.from('mrm-2fa-encryption-key-info', 'utf8'),
        32,
      ),
    );
    // Derive a 32-byte HMAC key for two-factor login tickets
    this.ticketKey = Buffer.from(
      crypto.hkdfSync(
        'sha256',
        Buffer.from(secretSource, 'utf8'),
        Buffer.from('mrm-2fa-ticket-salt', 'utf8'),
        Buffer.from('mrm-2fa-ticket-key-info', 'utf8'),
        32,
      ),
    );
  }

  /** Generates a fresh 20-byte base32 secret and an otpauth:// provisioning URI. */
  generateSecret(email: string, issuer = 'MRM InfoTech'): { secret: string; uri: string } {
    const randomBytes = crypto.randomBytes(20);
    const secret = base32Encode(randomBytes);
    const label = encodeURIComponent(`${issuer}:${email}`);
    const encIssuer = encodeURIComponent(issuer);
    const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
    return { secret, uri };
  }

  /** Encrypts the base32 secret using AES-256-GCM. */
  encryptSecret(secret: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encKey, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /** Decrypts an AES-256-GCM encrypted secret. */
  decryptSecret(encrypted: string): string {
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted secret format');
    }
    const [ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encKey, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /** Generates a 6-digit TOTP code for a secret at the given time step offset. */
  generateTotp(secret: string, timeStepOffset = 0): string {
    const secretBuffer = base32Decode(secret);
    const step = Math.floor(Date.now() / 1000 / 30) + timeStepOffset;

    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(step), 0);

    const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const codeInt =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    return (codeInt % 1000000).toString().padStart(6, '0');
  }

  /** Verifies a 6-digit TOTP code against secret, tolerating +/- 1 time step (30s) drift. */
  verifyTotp(secret: string, token: string): boolean {
    const cleanToken = token.trim();
    if (!/^\d{6}$/.test(cleanToken)) return false;

    // Check windows -1, 0, +1
    for (const offset of [0, -1, 1]) {
      try {
        const expected = this.generateTotp(secret, offset);
        if (
          expected.length === cleanToken.length &&
          crypto.timingSafeEqual(Buffer.from(cleanToken, 'utf8'), Buffer.from(expected, 'utf8'))
        ) {
          return true;
        }
      } catch {
        // Continue checking other windows
      }
    }
    return false;
  }

  /** Generates 8 one-time backup recovery codes formatted as 'xxxx-xxxx'. */
  generateRecoveryCodes(count = 8): { rawCodes: string[]; hashedCodes: string[] } {
    const rawCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < count; i++) {
      const part1 = crypto.randomBytes(2).toString('hex');
      const part2 = crypto.randomBytes(2).toString('hex');
      const code = `${part1}-${part2}`;
      rawCodes.push(code);
      hashedCodes.push(this.hashRecoveryCode(code));
    }

    return { rawCodes, hashedCodes };
  }

  /** Returns SHA-256 hash of a normalized recovery code. */
  hashRecoveryCode(code: string): string {
    const normalized = code
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  }

  /** Creates a signed, tamper-proof pending 2FA login ticket (valid for 5 minutes). */
  createTwoFactorTicket(userId: string, email: string): string {
    const payload: TwoFactorTicketPayload = {
      userId,
      email: email.toLowerCase(),
      exp: Date.now() + 5 * 60 * 1000,
    };
    const jsonStr = JSON.stringify(payload);
    const dataB64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
    const hmac = crypto.createHmac('sha256', this.ticketKey).update(dataB64).digest('hex');
    return `${dataB64}.${hmac}`;
  }

  /** Verifies a 2FA login ticket; returns payload if valid and unexpired, null otherwise. */
  verifyTwoFactorTicket(ticket: string): TwoFactorTicketPayload | null {
    if (!ticket || typeof ticket !== 'string') return null;
    const parts = ticket.split('.');
    if (parts.length !== 2) return null;
    const [dataB64, hmacHex] = parts;

    const expectedHmac = crypto.createHmac('sha256', this.ticketKey).update(dataB64).digest('hex');
    if (
      hmacHex.length !== expectedHmac.length ||
      !crypto.timingSafeEqual(Buffer.from(hmacHex, 'utf8'), Buffer.from(expectedHmac, 'utf8'))
    ) {
      return null;
    }

    try {
      const jsonStr = Buffer.from(dataB64, 'base64url').toString('utf8');
      const payload = JSON.parse(jsonStr) as TwoFactorTicketPayload;
      if (!payload.userId || !payload.exp || Date.now() > payload.exp) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }
}
