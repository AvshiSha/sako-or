/**
 * Validation for post-authentication return URLs.
 *
 * The review flow puts a `?redirect=` parameter on a signup link that we send to
 * customers over SMS and email. That makes an open redirect here a phishing vector
 * aimed at our own customers, delivered over a channel they already trust — so the
 * rule is deliberately strict: **same-origin relative paths only, nothing else.**
 *
 * Deliberately not clever. There is no attempt to "fix up" a suspicious value into a
 * safe one; anything that is not obviously a local path is rejected outright and the
 * caller falls back to its normal destination. A redirect that quietly does the
 * ordinary thing is a minor annoyance; one that lands a customer on an attacker's
 * login page is not.
 */

/** Highest code point treated as a control character (DEL). */
const DEL = 0x7f
/** Everything below this is a C0 control character (NUL, TAB, CR, LF, …). */
const FIRST_PRINTABLE = 0x20

/**
 * True if the string contains any control character.
 *
 * Written as a code-point scan rather than a regex on purpose: a regex needs literal
 * control characters or escape sequences in the source, and both are fragile to
 * copy, reformat and tooling that rewrites files. This version is unambiguous in
 * plain ASCII source.
 */
function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < FIRST_PRINTABLE || code === DEL) return true
  }
  return false
}

/**
 * Returns the value if it is a safe same-origin path, otherwise null.
 *
 * Rejected, with the attack each case prevents:
 *  - `//evil.com`            protocol-relative URL — browsers treat it as absolute
 *  - `/\evil.com`            backslash variant; some parsers normalise `\` to `/`
 *  - `https://evil.com`      absolute URL
 *  - `javascript:alert(1)`   scheme-based script execution
 *  - `evil.com`              no leading slash; resolves relative to the current dir
 *  - control characters      can truncate a value or split a header downstream
 */
export function sanitizeRedirect(value: string | null | undefined): string | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (hasControlCharacters(trimmed)) return null

  // Must be an absolute path on this origin.
  if (!trimmed.startsWith('/')) return null

  // `//host` and `/\host` are protocol-relative and resolve off-origin.
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return null

  // Split off query/hash before the remaining checks: a colon is legal inside a
  // query string (our review token contains one), but never inside the path.
  const separatorIndex = trimmed.search(/[?#]/)
  const path = separatorIndex === -1 ? trimmed : trimmed.slice(0, separatorIndex)

  // A colon in the path means a scheme slipped through.
  if (path.includes(':')) return null

  // Some user agents normalise backslashes to forward slashes, which can turn
  // `/foo/\/evil.com` into a protocol-relative URL after normalisation.
  if (path.includes('\\')) return null

  return trimmed
}

/**
 * Reads and validates a redirect from a URLSearchParams-like source.
 *
 * `fallback` is returned when the parameter is absent or fails validation, so no
 * call site has to decide for itself what "unsafe" means.
 */
export function resolveRedirect(
  params: { get(name: string): string | null } | null | undefined,
  fallback: string,
  paramName = 'redirect'
): string {
  return sanitizeRedirect(params?.get(paramName)) ?? fallback
}
