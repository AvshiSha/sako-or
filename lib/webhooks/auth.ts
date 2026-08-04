import 'server-only'
import crypto from 'crypto'
import type { WebhookAuthResult } from '../shipping/types'

/**
 * Pluggable inbound-webhook authentication.
 *
 * HFD's documented `Authorization: Bearer <token>` covers **our outbound calls to
 * them**; they have not specified how their PUSH authenticates to us, and their
 * OpenAPI spec has no webhook-registration endpoint (PUSH is configured manually by
 * their support). So rather than guess, each mechanism is implemented here behind a
 * common interface and selected by env var. When HFD tells us which one they use,
 * turning it on is a config change.
 *
 * Deliberately NOT modelled on `app/api/webhook/cardcom/route.ts`, whose auth has
 * three problems worth avoiding: it reuses RESEND_API_KEY (an unrelated credential)
 * as the shared secret, it accepts that secret from a `?bypass=` query parameter
 * where it lands in access logs, and its signature check is opt-in — omitting the
 * header skips validation entirely.
 */

/** Supported mechanisms. `off` accepts anything but flags it loudly. */
export type WebhookAuthMode = 'off' | 'secret' | 'bearer' | 'hmac'

export interface WebhookAuthConfig {
  mode: WebhookAuthMode
  /** Shared secret / bearer token / HMAC key, depending on `mode`. */
  secret?: string
  /** Header carrying the credential. Defaults per mode. */
  headerName?: string
  /** For `hmac`: the digest encoding HFD would send. */
  hmacEncoding?: 'hex' | 'base64'
}

/** Constant-time comparison that does not leak length via an early return path. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

function verifySharedSecret(
  headers: Headers,
  secret: string,
  headerName: string
): WebhookAuthResult {
  const provided = headers.get(headerName)
  if (!provided) {
    return { outcome: 'rejected', reason: `Missing ${headerName} header` }
  }
  return safeEqual(provided.trim(), secret)
    ? { outcome: 'verified' }
    : { outcome: 'rejected', reason: `Invalid ${headerName} value` }
}

function verifyBearer(headers: Headers, secret: string): WebhookAuthResult {
  const authorization = headers.get('authorization')
  if (!authorization) {
    return { outcome: 'rejected', reason: 'Missing Authorization header' }
  }
  const token = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return { outcome: 'rejected', reason: 'Malformed Authorization header' }
  }
  return safeEqual(token, secret)
    ? { outcome: 'verified' }
    : { outcome: 'rejected', reason: 'Invalid bearer token' }
}

function verifyHmac(
  headers: Headers,
  rawBody: string,
  secret: string,
  headerName: string,
  encoding: 'hex' | 'base64'
): WebhookAuthResult {
  const provided = headers.get(headerName)
  if (!provided) {
    // Fail closed. An HMAC check that only runs when the header happens to be
    // present is not a check at all.
    return { outcome: 'rejected', reason: `Missing ${headerName} signature header` }
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest(encoding)

  // Tolerate a "sha256=" prefix, which several providers prepend.
  const normalized = provided.trim().replace(/^sha256=/i, '')

  return safeEqual(normalized, expected)
    ? { outcome: 'verified' }
    : { outcome: 'rejected', reason: 'Signature mismatch' }
}

/**
 * Authenticates an inbound webhook request against `config`.
 *
 * When no secret is configured the request is accepted but reported as
 * `unauthenticated`, never as `verified` — the caller logs a warning and records the
 * outcome on the webhook_events row, so an endpoint running open is visible in the
 * data rather than being silently indistinguishable from a verified one.
 */
export function verifyWebhookAuth(
  headers: Headers,
  rawBody: string,
  config: WebhookAuthConfig
): WebhookAuthResult {
  if (config.mode === 'off') {
    return { outcome: 'unauthenticated', reason: 'No auth mode configured' }
  }

  if (!config.secret) {
    // Mode was requested but the secret is missing: treat as misconfiguration and
    // fail closed rather than silently downgrading to open.
    return { outcome: 'rejected', reason: `Auth mode "${config.mode}" set but secret is missing` }
  }

  switch (config.mode) {
    case 'secret':
      return verifySharedSecret(headers, config.secret, config.headerName ?? 'x-webhook-secret')
    case 'bearer':
      return verifyBearer(headers, config.secret)
    case 'hmac':
      return verifyHmac(
        headers,
        rawBody,
        config.secret,
        config.headerName ?? 'x-webhook-signature',
        config.hmacEncoding ?? 'hex'
      )
    default:
      return { outcome: 'rejected', reason: 'Unknown auth mode' }
  }
}

/** Reads a webhook auth config from env, given a provider-specific var prefix. */
export function authConfigFromEnv(prefix: string): WebhookAuthConfig {
  const rawMode = (process.env[`${prefix}_WEBHOOK_AUTH_MODE`] ?? 'off').trim().toLowerCase()
  const mode: WebhookAuthMode = ['off', 'secret', 'bearer', 'hmac'].includes(rawMode)
    ? (rawMode as WebhookAuthMode)
    : 'off'

  return {
    mode,
    secret: process.env[`${prefix}_WEBHOOK_SECRET`],
    headerName: process.env[`${prefix}_WEBHOOK_HEADER`],
    hmacEncoding:
      process.env[`${prefix}_WEBHOOK_HMAC_ENCODING`] === 'base64' ? 'base64' : 'hex',
  }
}
