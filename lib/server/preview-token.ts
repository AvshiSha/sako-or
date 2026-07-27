import 'server-only'
import crypto from 'crypto'

const DEFAULT_TTL_MS = 30 * 60 * 1000 // 30 minutes

function getSecret(): string {
  const secret = process.env.PREVIEW_TOKEN_SECRET
  if (!secret) {
    throw new Error('PREVIEW_TOKEN_SECRET is not configured')
  }
  return secret
}

function sign(draftId: string, expiresAt: number): string {
  return crypto.createHmac('sha256', getSecret()).update(`${draftId}.${expiresAt}`).digest('hex')
}

/**
 * Mints a short-lived, HMAC-signed token proving the holder was handed this
 * link by an admin-authorized request (the token is only ever issued by the
 * requireAdmin-gated draft API route). Possession of a valid token is the
 * actual server-side authorization check for the preview route — the
 * client-side admin route guard is a secondary UX nicety, not the real gate.
 */
export function signPreviewToken(draftId: string, ttlMs: number = DEFAULT_TTL_MS): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + ttlMs
  const signature = sign(draftId, expiresAt)
  return { token: `${expiresAt}.${signature}`, expiresAt }
}

export function verifyPreviewToken(draftId: string, token: string | null | undefined): boolean {
  if (!token) return false
  const [expiresAtRaw, signature] = token.split('.')
  if (!expiresAtRaw || !signature) return false

  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false

  const expectedSignature = sign(draftId, expiresAt)
  const expectedBuf = Buffer.from(expectedSignature, 'hex')
  const actualBuf = Buffer.from(signature, 'hex')
  if (expectedBuf.length !== actualBuf.length) return false

  return crypto.timingSafeEqual(expectedBuf, actualBuf)
}
