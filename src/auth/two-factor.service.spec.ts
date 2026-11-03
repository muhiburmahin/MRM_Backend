import { TwoFactorService } from './two-factor.service';
import { testCfg } from './test-helpers';

describe('TwoFactorService', () => {
  let svc: TwoFactorService;

  beforeEach(() => {
    svc = new TwoFactorService(testCfg);
  });

  describe('Secret Generation & Encryption', () => {
    it('generates a valid base32 secret and otpauth URI', () => {
      const res = svc.generateSecret('admin@mrminfotech.com');
      expect(res.secret).toMatch(/^[A-Z2-7]{32}$/);
      expect(res.uri).toContain('otpauth://totp/');
      expect(res.uri).toContain(res.secret);
      expect(res.uri).toContain('MRM%20InfoTech');
    });

    it('encrypts and decrypts secret with AES-256-GCM', () => {
      const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
      const encrypted = svc.encryptSecret(secret);
      expect(encrypted).not.toBe(secret);
      expect(encrypted.split(':')).toHaveLength(3);

      const decrypted = svc.decryptSecret(encrypted);
      expect(decrypted).toBe(secret);
    });

    it('throws when trying to decrypt invalid or tampered ciphertext', () => {
      expect(() => svc.decryptSecret('invalid:payload')).toThrow();
      const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
      const [iv, tag, data] = svc.encryptSecret(secret).split(':');
      // Tamper with data
      const tamperedData = (parseInt(data.slice(0, 2), 16) ^ 0xff).toString(16) + data.slice(2);
      expect(() => svc.decryptSecret(`${iv}:${tag}:${tamperedData}`)).toThrow();
    });
  });

  describe('TOTP Verification', () => {
    it('generates a valid 6-digit code and verifies it', () => {
      const { secret } = svc.generateSecret('test@example.com');
      const code = svc.generateTotp(secret);
      expect(code).toMatch(/^\d{6}$/);
      expect(svc.verifyTotp(secret, code)).toBe(true);
    });

    it('verifies code within +/- 1 time step (30s drift tolerance)', () => {
      const { secret } = svc.generateSecret('test@example.com');
      const pastCode = svc.generateTotp(secret, -1);
      const futureCode = svc.generateTotp(secret, 1);
      expect(svc.verifyTotp(secret, pastCode)).toBe(true);
      expect(svc.verifyTotp(secret, futureCode)).toBe(true);
    });

    it('rejects an outdated code (+/- 2 steps) or invalid code', () => {
      const { secret } = svc.generateSecret('test@example.com');
      const farPastCode = svc.generateTotp(secret, -2);
      expect(svc.verifyTotp(secret, farPastCode)).toBe(false);
      expect(svc.verifyTotp(secret, '000000')).toBe(false);
      expect(svc.verifyTotp(secret, 'bad123')).toBe(false);
    });
  });

  describe('Recovery Codes', () => {
    it('generates 8 recovery codes with format xxxx-xxxx and matching hashes', () => {
      const { rawCodes, hashedCodes } = svc.generateRecoveryCodes(8);
      expect(rawCodes).toHaveLength(8);
      expect(hashedCodes).toHaveLength(8);

      for (let i = 0; i < rawCodes.length; i++) {
        expect(rawCodes[i]).toMatch(/^[a-f0-9]{4}-[a-f0-9]{4}$/);
        expect(svc.hashRecoveryCode(rawCodes[i])).toBe(hashedCodes[i]);
      }
    });

    it('normalizes recovery code case and separators before hashing', () => {
      const code1 = 'A1B2-C3D4';
      const code2 = 'a1b2c3d4';
      expect(svc.hashRecoveryCode(code1)).toBe(svc.hashRecoveryCode(code2));
    });
  });

  describe('Two-Factor Login Ticket', () => {
    it('creates and verifies a valid ticket', () => {
      const ticket = svc.createTwoFactorTicket('user-123', 'admin@example.com');
      const payload = svc.verifyTwoFactorTicket(ticket);
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe('user-123');
      expect(payload?.email).toBe('admin@example.com');
    });

    it('rejects tampered or forged ticket', () => {
      const ticket = svc.createTwoFactorTicket('user-123', 'admin@example.com');
      const [dataB64] = ticket.split('.');
      const forgedTicket = `${dataB64}.0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`;
      expect(svc.verifyTwoFactorTicket(forgedTicket)).toBeNull();
    });

    it('rejects expired ticket', () => {
      jest.useFakeTimers();
      const ticket = svc.createTwoFactorTicket('user-123', 'admin@example.com');
      jest.advanceTimersByTime(6 * 60 * 1000); // 6 minutes (TTL is 5)
      expect(svc.verifyTwoFactorTicket(ticket)).toBeNull();
      jest.useRealTimers();
    });
  });
});
