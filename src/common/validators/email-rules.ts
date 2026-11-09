/**
 * Strict email rules for public forms. Pure functions (no I/O) so the identical logic can be unit-tested
 * and mirrored on the frontend (`src/lib/validation/email.ts` in MRMinfotech-frontend).
 *
 * This validates structure (RFC 5321/5322 subset), rejects reserved/placeholder domains and well-known
 * disposable providers. It deliberately does NOT perform a live DNS/MX lookup: that adds seconds of latency,
 * behaves unpredictably behind firewalls, and is trivially bypassed by any real domain.
 */

export const DISPOSABLE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  '10minutemail.com', '10minutemail.net', '20minutemail.com', 'bccto.me', 'burnermail.io', 'byom.de',
  'dispostable.com', 'dropmail.me', 'emailondeck.com', 'fakeinbox.com', 'fakemail.net', 'getairmail.com',
  'getnada.com', 'guerrillamail.biz', 'guerrillamail.com', 'guerrillamail.de', 'guerrillamail.net',
  'guerrillamail.org', 'guerrillamailblock.com', 'grr.la', 'harakirimail.com', 'inboxbear.com',
  'jetable.org', 'mailcatch.com', 'maildrop.cc', 'mailinator.com', 'mailinator.net', 'mailnesia.com',
  'mailsac.com', 'mintemail.com', 'mohmal.com', 'mytemp.email', 'nada.email', 'sharklasers.com',
  'spam4.me', 'spamgourmet.com', 'temp-mail.io', 'temp-mail.org', 'tempail.com', 'tempinbox.com',
  'tempmail.com', 'tempmail.net', 'tempmailo.com', 'tempr.email', 'throwawaymail.com', 'trashmail.com',
  'trashmail.de', 'trashmail.net', 'yopmail.com', 'yopmail.fr', 'yopmail.net', 'moakt.com',
  'tmail.ws', 'tmpmail.net', 'tmpmail.org', 'emailfake.com', 'crazymailing.com', 'discard.email',
  'mail.tm', 'mailtemp.info', 'luxusmail.org', 'spambox.us', 'cool.fr.nf',
]);

/** Placeholder / reserved domains that can never receive real mail. */
const FAKE_DOMAINS: ReadonlySet<string> = new Set([
  'example.com', 'example.net', 'example.org', 'yourdomain.com', 'yourcompany.com', 'mydomain.com', 'localhost',
]);
const RESERVED_TLDS: ReadonlySet<string> = new Set([
  'test', 'example', 'invalid', 'localhost', 'local', 'internal', 'lan', 'home', 'corp', 'onion',
]);

const LOCAL_PART = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD = /^(?:[a-z]{2,24}|xn--[a-z0-9-]{2,59})$/;

export type EmailProblem = 'required' | 'format' | 'too_long' | 'domain' | 'fake_domain' | 'disposable';

export const EMAIL_MESSAGES: Record<EmailProblem, string> = {
  required: 'Email address is required',
  format: 'Enter a valid email address, for example name@company.com',
  too_long: 'Email address is too long',
  domain: 'The email domain looks invalid. Check it for typos',
  fake_domain: 'Use a real email address, not a placeholder or test domain',
  disposable: 'Disposable or temporary email addresses are not accepted. Use your work or personal email',
};

/** Returns the first problem found, or `null` when the address is acceptable. */
export function findEmailProblem(raw: unknown): EmailProblem | null {
  if (typeof raw !== 'string' || raw.trim() === '') return 'required';
  const email = raw.trim().toLowerCase();
  if (email.length > 254) return 'too_long';

  const at = email.lastIndexOf('@');
  if (at < 1 || at !== email.indexOf('@') || at === email.length - 1) return 'format';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || !LOCAL_PART.test(local)) return 'format';

  if (domain.length > 253) return 'domain';
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some((l) => !DOMAIN_LABEL.test(l))) return 'domain';
  const tld = labels[labels.length - 1];
  if (!TLD.test(tld)) return 'domain'; // also rejects IP literals (numeric TLD)

  if (FAKE_DOMAINS.has(domain) || RESERVED_TLDS.has(tld)) return 'fake_domain';
  // Match the domain or any parent (so sub.mailinator.com is also blocked).
  for (let i = 0; i < labels.length - 1; i += 1) {
    if (DISPOSABLE_EMAIL_DOMAINS.has(labels.slice(i).join('.'))) return 'disposable';
  }
  return null;
}

export const isStrictEmail = (value: unknown): boolean => findEmailProblem(value) === null;
