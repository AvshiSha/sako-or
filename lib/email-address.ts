/**
 * Shared email address validation and normalisation.
 *
 * This replaces the `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` + `.includes('..')` pair that
 * was copy-pasted across the checkout API, the payments API and the payer form.
 * That pair rejected `user@gmail..com` but happily accepted a dot touching the
 * `@`, because `[^\s@]+` matches a trailing dot in the local part.
 *
 * Order ORDER-1795682631457 reached payment with `meira_sabag.@walla.com` and
 * Resend rejected the confirmation with a 422 `validation_error`, so neither the
 * customer nor the shop received anything. Validate here instead of inventing a
 * new regex at each call site.
 */

/**
 * Bidi control characters that get pasted in from RTL form fields.
 *
 * Two separate expressions on purpose: a `/g` regex carries `lastIndex` between
 * `.test()` calls, so sharing one instance between the stripper and the checker
 * would make validation depend on what was validated before it.
 */
const BIDI_MARKS_GLOBAL = /[‎‏‪-‮⁦-⁩]/g;
const BIDI_MARKS = /[‎‏‪-‮⁦-⁩]/;

/**
 * Repair the typos we can repair without guessing: surrounding whitespace, bidi
 * marks, doubled dots, and a dot adjacent to the `@` on either side. Everything
 * here turns an address that is definitely invalid into the single address the
 * user plainly meant; it never rewrites one valid address into another.
 *
 * Use this on the way out (sending, lookup), not as a substitute for validating
 * input: at a form the customer should be asked to correct their own address.
 */
export function normalizeEmailAddress(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(BIDI_MARKS_GLOBAL, '')
    .replace(/\.{2,}/g, '.') // user@gmail..com  -> user@gmail.com
    .replace(/\.+@/, '@') //    name.@walla.com  -> name@walla.com
    .replace(/@\.+/, '@'); //   name@.walla.com  -> name@walla.com
}

/**
 * Structural validation, deliberately stricter than the old regex about dots.
 * Kept permissive about non-ASCII local parts, which the old regex allowed and
 * which Resend accepts.
 */
export function isValidEmailAddress(input: unknown): boolean {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value || value.length > 254) return false;
  if (/\s/.test(value)) return false;
  if (BIDI_MARKS.test(value)) return false;

  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1) return false;

  const local = value.slice(0, at);
  const domain = value.slice(at + 1);

  // Local part: no second `@`, no leading/trailing dot, no doubled dots.
  if (local.includes('@') || local.length > 64) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;

  // Domain: ASCII letters, digits, dots and hyphens, at least two labels.
  if (!/^[A-Za-z0-9.-]+$/.test(domain)) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false;
  if (domain.startsWith('-') || domain.endsWith('-')) return false;

  const labels = domain.split('.');
  if (labels.length < 2) return false;
  if (labels.some((label) => label.length === 0 || label.length > 63)) return false;
  if (labels.some((label) => label.startsWith('-') || label.endsWith('-'))) return false;

  // TLD: letters, or a punycode IDN label.
  const tld = labels[labels.length - 1];
  if (!/^(?:[A-Za-z]{2,}|xn--[A-Za-z0-9-]+)$/.test(tld)) return false;

  return true;
}

/**
 * Normalise, then validate. Returns the address to actually send to, or `null`
 * when nothing sendable can be recovered from the input.
 */
export function toSendableEmailAddress(input: unknown): string | null {
  const normalized = normalizeEmailAddress(input);
  return isValidEmailAddress(normalized) ? normalized : null;
}
