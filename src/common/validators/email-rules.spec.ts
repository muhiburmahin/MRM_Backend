import { findEmailProblem, isStrictEmail } from './email-rules';

describe('findEmailProblem', () => {
  it.each([
    'name@company.com',
    'First.Last@Sub.Company.co.uk',
    'zoe+quote@acme-industries.io',
    "o'brien@acme.org",
    'user@xn--bcher-kva.example-bank.de',
    '  padded@acme-industries.com  ',
  ])('accepts %s', (email) => {
    expect(findEmailProblem(email)).toBeNull();
    expect(isStrictEmail(email)).toBe(true);
  });

  it.each([
    [undefined, 'required'],
    [null, 'required'],
    ['', 'required'],
    ['   ', 'required'],
    [42, 'required'],
    ['plainaddress', 'format'],
    ['name@', 'format'],
    ['@company.com', 'format'],
    ['a@b@company.com', 'format'],
    ['na me@company.com', 'format'],
    ['na..me@company.com', 'format'],
    ['.name@company.com', 'format'],
    ['name.@company.com', 'format'],
    ['name@company', 'domain'],
    ['name@company.c', 'domain'],
    ['name@192.168.0.1', 'domain'],
    ['name@.company.com', 'domain'],
    ['name@-company.com', 'domain'],
    ['name@company..com', 'domain'],
    ['name@example.com', 'fake_domain'],
    ['name@company.test', 'fake_domain'],
    ['name@printer.local', 'fake_domain'],
    ['name@mailinator.com', 'disposable'],
    ['name@box.yopmail.com', 'disposable'],
    [`${'a'.repeat(65)}@company.com`, 'format'],
    [`${'a'.repeat(250)}@company.com`, 'too_long'],
  ])('rejects %p as %s', (email, problem) => {
    expect(findEmailProblem(email)).toBe(problem);
  });
});
