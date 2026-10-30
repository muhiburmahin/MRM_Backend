import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const svc = new PasswordService();

  it('hashes with argon2id and verifies', async () => {
    const hash = await svc.hash('correct horse battery');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('correct horse');
    expect(await svc.verify(hash, 'correct horse battery')).toBe(true);
    expect(await svc.verify(hash, 'wrong password!!')).toBe(false);
  });

  it('returns false (not throw) for a malformed hash', async () => {
    expect(await svc.verify('not-a-hash', 'x')).toBe(false);
  });

  it('enforces the policy', () => {
    expect(svc.validatePolicy('short')).not.toHaveLength(0);
    expect(svc.validatePolicy('aaaaaaaaaaaaaaaa')).not.toHaveLength(0);
    expect(svc.validatePolicy('johnsmith-secret-1', { email: 'johnsmith@x.com' })).not.toHaveLength(0);
    expect(svc.validatePolicy('a-long-enough-passphrase', { email: 'jane@x.com' })).toEqual([]);
  });
});
