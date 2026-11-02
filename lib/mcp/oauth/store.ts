import 'server-only'

import { adminDb } from '@/lib/firebase-admin'
import {
  ACCESS_TOKEN_TTL_MS,
  AUTH_CODE_TTL_MS,
  AUTH_REQUEST_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
} from '@/lib/mcp/oauth/config'
import {
  generateClientId,
  generateFamilyId,
  generateToken,
  hashToken,
} from '@/lib/mcp/oauth/crypto'

/**
 * Persistence for the MCP authorization server.
 *
 * Firestore rather than memory. The storefront's OTP helper keeps codes in a
 * process-global Map, which only works while the send and the verify happen to
 * land on the same warm serverless instance -- acceptable for a login a user
 * will retry, not for the one-shot flow that grants an automated client write
 * access. Every short-lived artifact here is therefore a document, keyed by the
 * hash of the credential it represents so the lookup needs no index and the
 * plaintext is never stored.
 *
 * Expiry is enforced on read, not by a TTL policy. A Firestore TTL deletes
 * lazily -- documents can outlive their timestamp by hours -- so treating the
 * stored `expiresAt` as authoritative is what actually makes a code expire.
 * TTL is still worth configuring on these collections, but only as a
 * housekeeping measure.
 */

const CLIENTS = 'mcpOauthClients'
const AUTH_REQUESTS = 'mcpAuthRequests'
const CODES = 'mcpOauthCodes'
const ACCESS_TOKENS = 'mcpOauthAccessTokens'
const REFRESH_TOKENS = 'mcpOauthRefreshTokens'
const OTP_CODES = 'mcpOtpCodes'

// ── Clients ────────────────────────────────────────────────────────────────

export interface RegisteredClient {
  clientId: string
  clientName: string
  redirectUris: string[]
  createdAt: string
}

export async function registerClient(input: {
  clientName: string
  redirectUris: string[]
}): Promise<RegisteredClient> {
  const clientId = generateClientId()
  const client: RegisteredClient = {
    clientId,
    clientName: input.clientName.slice(0, 200),
    redirectUris: input.redirectUris,
    createdAt: new Date().toISOString(),
  }
  await adminDb.collection(CLIENTS).doc(clientId).set(client)
  return client
}

export async function getClient(clientId: string): Promise<RegisteredClient | null> {
  if (!clientId) return null
  const snap = await adminDb.collection(CLIENTS).doc(clientId).get()
  if (!snap.exists) return null
  return snap.data() as RegisteredClient
}

// ── Pending authorization requests ─────────────────────────────────────────

export interface AuthRequest {
  requestId: string
  clientId: string
  redirectUri: string
  state: string | null
  codeChallenge: string
  scopes: string[]
  resource: string
  expiresAt: number
  /** Set once the OTP has been verified; the approve step requires it. */
  verifiedEmail?: string
}

/**
 * Park an authorize request so the consent page can carry an opaque id instead
 * of the whole request in its query string.
 *
 * The parameters stay server-side for the duration, which means the consent
 * page cannot be tricked into approving a different redirect_uri than the one
 * that was validated -- the page never sees it and never sends it back.
 */
export async function createAuthRequest(input: {
  clientId: string
  redirectUri: string
  state: string | null
  codeChallenge: string
  scopes: string[]
  resource: string
}): Promise<string> {
  const requestId = generateToken()
  const record: AuthRequest = {
    requestId,
    ...input,
    expiresAt: Date.now() + AUTH_REQUEST_TTL_MS,
  }
  await adminDb.collection(AUTH_REQUESTS).doc(hashToken(requestId)).set(record)
  return requestId
}

export async function getAuthRequest(requestId: string): Promise<AuthRequest | null> {
  if (!requestId) return null
  const snap = await adminDb.collection(AUTH_REQUESTS).doc(hashToken(requestId)).get()
  if (!snap.exists) return null
  const record = snap.data() as AuthRequest
  if (record.expiresAt < Date.now()) return null
  return record
}

export async function markAuthRequestVerified(
  requestId: string,
  email: string
): Promise<void> {
  await adminDb
    .collection(AUTH_REQUESTS)
    .doc(hashToken(requestId))
    .update({ verifiedEmail: email })
}

export async function deleteAuthRequest(requestId: string): Promise<void> {
  await adminDb.collection(AUTH_REQUESTS).doc(hashToken(requestId)).delete()
}

// ── One-time OTP codes for the consent page ────────────────────────────────

export interface OtpRecord {
  codeHash: string
  expiresAt: number
  attempts: number
  lastSentAt: number
}

/** Keyed by the hash of the email so the collection holds no address in the clear. */
function otpDocId(email: string): string {
  return hashToken(`otp:${email}`)
}

export async function getOtpRecord(email: string): Promise<OtpRecord | null> {
  const snap = await adminDb.collection(OTP_CODES).doc(otpDocId(email)).get()
  if (!snap.exists) return null
  return snap.data() as OtpRecord
}

export async function putOtpRecord(email: string, code: string): Promise<void> {
  const record: OtpRecord = {
    codeHash: hashToken(code),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now(),
  }
  await adminDb.collection(OTP_CODES).doc(otpDocId(email)).set(record)
}

export type OtpCheckResult =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'expired' | 'locked' | 'mismatch' }

/**
 * Check a submitted code and consume it on success.
 *
 * The attempt counter increments inside a transaction, so parallel guesses
 * cannot each read the same count and collectively exceed the limit. A
 * successful code is deleted rather than marked used -- there is no second
 * legitimate use for it.
 */
export async function consumeOtpCode(email: string, code: string): Promise<OtpCheckResult> {
  const ref = adminDb.collection(OTP_CODES).doc(otpDocId(email))

  return adminDb.runTransaction<OtpCheckResult>(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return { ok: false, reason: 'missing' }

    const record = snap.data() as OtpRecord
    if (record.expiresAt < Date.now()) {
      tx.delete(ref)
      return { ok: false, reason: 'expired' }
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      tx.delete(ref)
      return { ok: false, reason: 'locked' }
    }
    if (record.codeHash !== hashToken(code)) {
      tx.update(ref, { attempts: record.attempts + 1 })
      return { ok: false, reason: 'mismatch' }
    }

    tx.delete(ref)
    return { ok: true }
  })
}

// ── Authorization codes ────────────────────────────────────────────────────

export interface AuthCodeRecord {
  clientId: string
  redirectUri: string
  codeChallenge: string
  scopes: string[]
  resource: string
  email: string
  expiresAt: number
}

export async function issueAuthCode(record: Omit<AuthCodeRecord, 'expiresAt'>): Promise<string> {
  const code = generateToken()
  await adminDb
    .collection(CODES)
    .doc(hashToken(code))
    .set({ ...record, expiresAt: Date.now() + AUTH_CODE_TTL_MS })
  return code
}

/**
 * Exchange a code exactly once.
 *
 * The delete and the read happen in one transaction, so two simultaneous token
 * requests with the same code cannot both succeed. A replayed code therefore
 * fails as "already used" rather than minting a second token.
 */
export async function consumeAuthCode(code: string): Promise<AuthCodeRecord | null> {
  if (!code) return null
  const ref = adminDb.collection(CODES).doc(hashToken(code))

  return adminDb.runTransaction<AuthCodeRecord | null>(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return null

    const record = snap.data() as AuthCodeRecord
    tx.delete(ref)
    if (record.expiresAt < Date.now()) return null
    return record
  })
}

// ── Access and refresh tokens ──────────────────────────────────────────────

export interface AccessTokenRecord {
  email: string
  clientId: string
  scopes: string[]
  resource: string
  familyId: string
  expiresAt: number
  revoked?: boolean
}

export interface RefreshTokenRecord extends AccessTokenRecord {
  consumedAt?: number
  revoked?: boolean
}

export interface IssuedTokens {
  accessToken: string
  refreshToken: string | null
  expiresIn: number
  scopes: string[]
}

/**
 * Mint an access token, and a refresh token when offline_access was granted.
 *
 * Both share a `familyId` so a detected refresh replay can revoke everything
 * descended from one consent, not just the single token that was replayed.
 */
export async function issueTokens(input: {
  email: string
  clientId: string
  scopes: string[]
  resource: string
  familyId?: string
  withRefresh: boolean
}): Promise<IssuedTokens> {
  const familyId = input.familyId ?? generateFamilyId()
  const accessToken = generateToken()
  const expiresAt = Date.now() + ACCESS_TOKEN_TTL_MS

  const base = {
    email: input.email,
    clientId: input.clientId,
    scopes: input.scopes,
    resource: input.resource,
    familyId,
  }

  const writes: Promise<unknown>[] = [
    adminDb
      .collection(ACCESS_TOKENS)
      .doc(hashToken(accessToken))
      .set({ ...base, expiresAt } satisfies AccessTokenRecord),
  ]

  let refreshToken: string | null = null
  if (input.withRefresh) {
    refreshToken = generateToken()
    writes.push(
      adminDb
        .collection(REFRESH_TOKENS)
        .doc(hashToken(refreshToken))
        .set({ ...base, expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS } satisfies RefreshTokenRecord)
    )
  }

  await Promise.all(writes)

  return {
    accessToken,
    refreshToken,
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    scopes: input.scopes,
  }
}

export async function getAccessToken(token: string): Promise<AccessTokenRecord | null> {
  if (!token) return null
  const snap = await adminDb.collection(ACCESS_TOKENS).doc(hashToken(token)).get()
  if (!snap.exists) return null

  const record = snap.data() as AccessTokenRecord
  // Revocation also zeroes expiresAt, so either check alone would do. Both are
  // here because relying on the side effect would make the revocation path
  // fragile the next time somebody changes how revokeFamily marks a token.
  if (record.revoked) return null
  if (record.expiresAt < Date.now()) return null
  return record
}

export type RefreshResult =
  | { ok: true; record: RefreshTokenRecord }
  | { ok: false; reason: 'unknown' | 'expired' | 'replayed' }

/**
 * Consume a refresh token, detecting reuse.
 *
 * Rotation means a used refresh token is never valid again. Seeing one
 * presented a second time has only two explanations -- a client that lost the
 * response to a successful refresh, or an attacker replaying a stolen token --
 * and the two are indistinguishable from here. RFC 9700 says to assume the
 * worse one: the whole family is revoked, which forces a fresh consent.
 */
export async function consumeRefreshToken(token: string): Promise<RefreshResult> {
  if (!token) return { ok: false, reason: 'unknown' }
  const ref = adminDb.collection(REFRESH_TOKENS).doc(hashToken(token))

  const outcome = await adminDb.runTransaction<RefreshResult>(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return { ok: false, reason: 'unknown' }

    const record = snap.data() as RefreshTokenRecord
    if (record.revoked) return { ok: false, reason: 'replayed' }
    if (record.consumedAt) return { ok: false, reason: 'replayed' }
    if (record.expiresAt < Date.now()) {
      tx.delete(ref)
      return { ok: false, reason: 'expired' }
    }

    tx.update(ref, { consumedAt: Date.now() })
    return { ok: true, record }
  })

  if (!outcome.ok && outcome.reason === 'replayed') {
    const snap = await ref.get()
    const familyId = (snap.data() as RefreshTokenRecord | undefined)?.familyId
    if (familyId) await revokeFamily(familyId)
  }

  return outcome
}

/**
 * Revoke every token descended from one consent.
 *
 * Batched in chunks for the same reason lib/server/faq-mutations.ts chunks its
 * writes: Firestore caps a batch at 500 operations, and a revocation must not
 * half-apply.
 */
export async function revokeFamily(familyId: string): Promise<void> {
  for (const collectionName of [ACCESS_TOKENS, REFRESH_TOKENS]) {
    const snapshot = await adminDb
      .collection(collectionName)
      .where('familyId', '==', familyId)
      .get()

    const docs = snapshot.docs
    for (let i = 0; i < docs.length; i += 450) {
      const batch = adminDb.batch()
      for (const doc of docs.slice(i, i + 450)) {
        batch.update(doc.ref, { revoked: true, expiresAt: 0 })
      }
      await batch.commit()
    }
  }
}

/** Revoke everything issued to one email. Used when the content role is withdrawn. */
export async function revokeAllForEmail(email: string): Promise<number> {
  let revoked = 0
  for (const collectionName of [ACCESS_TOKENS, REFRESH_TOKENS]) {
    const snapshot = await adminDb
      .collection(collectionName)
      .where('email', '==', email)
      .get()

    const docs = snapshot.docs
    for (let i = 0; i < docs.length; i += 450) {
      const batch = adminDb.batch()
      for (const doc of docs.slice(i, i + 450)) {
        batch.update(doc.ref, { revoked: true, expiresAt: 0 })
      }
      await batch.commit()
      revoked += Math.min(450, docs.length - i)
    }
  }
  return revoked
}
