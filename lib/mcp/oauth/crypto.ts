import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

/**
 * Credential generation and comparison for the MCP authorization server.
 *
 * Nothing here stores a secret in recoverable form. Authorization codes, access
 * tokens and refresh tokens are random bytes handed to the client once and kept
 * only as a SHA-256 digest, so a dump of the Firestore collections yields
 * nothing that can be replayed. SHA-256 without a salt is the right primitive
 * for this and not a shortcut: these are 256-bit random strings, not passwords,
 * so there is no dictionary to defend against and the digest has to be
 * computable from the presented token alone to look it up.
 */

/** 256 bits, base64url. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** A client identifier. Not a secret -- it only needs to be unguessable enough to avoid collisions. */
export function generateClientId(): string {
  return `mcp_${randomBytes(16).toString('hex')}`
}

/**
 * A six-digit OTP from the CSPRNG.
 *
 * `randomInt` rather than the `Math.random()` the storefront's OTP helper uses:
 * this code is the only thing between an email address and write access to the
 * live site, and `Math.random()` is both predictable from prior outputs and
 * biased.
 */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  // timingSafeEqual throws on unequal lengths, and length is not the secret.
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Verify an RFC 7636 S256 PKCE challenge.
 *
 * Only S256. `plain` is accepted by the spec for legacy clients and offers no
 * protection at all -- the verifier and the challenge are the same string -- so
 * the metadata document advertises S256 alone and this refuses anything else.
 */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false
  // RFC 7636 section 4.1: 43-128 characters from the unreserved set.
  if (verifier.length < 43 || verifier.length > 128) return false
  if (!/^[A-Za-z0-9\-._~]+$/.test(verifier)) return false

  const computed = createHash('sha256').update(verifier).digest('base64url')
  return constantTimeEquals(computed, challenge)
}

/** Opaque identifier for a refresh-token family, so a replay can revoke all of it. */
export function generateFamilyId(): string {
  return randomBytes(12).toString('hex')
}
