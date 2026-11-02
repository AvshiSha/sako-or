/**
 * Endpoint layout and policy constants for the MCP authorization server.
 *
 * ChatGPT discovers all of this from the two .well-known documents, so these
 * values are a published contract: changing a path invalidates an existing
 * connector registration and the specialist has to reconnect.
 */

/** Scopes this server issues. */
export const SCOPE_CONTENT_READ = 'content:read'
export const SCOPE_CONTENT_WRITE = 'content:write'
export const SCOPE_OFFLINE_ACCESS = 'offline_access'

/**
 * Defined so the name is reserved and the tool layer can check for it, but
 * never granted by the consent flow.
 *
 * Publication is a cron transition in this integration, not something a token
 * can authorize. Keeping the scope named makes that an explicit refusal rather
 * than an absence somebody later reads as an oversight.
 */
export const SCOPE_CONTENT_PUBLISH = 'content:publish'

export const GRANTABLE_SCOPES = [
  SCOPE_CONTENT_READ,
  SCOPE_CONTENT_WRITE,
  SCOPE_OFFLINE_ACCESS,
] as const

export const SUPPORTED_SCOPES = [...GRANTABLE_SCOPES, SCOPE_CONTENT_PUBLISH] as const

/** Lifetimes. Short access tokens, long rotating refresh tokens. */
export const AUTH_REQUEST_TTL_MS = 10 * 60 * 1000

/**
 * How long an authorization code stays redeemable.
 *
 * This was 60 seconds, which broke the very first real ChatGPT connection:
 * consent completed at 14:22:50, the code expired at 14:23:49, and ChatGPT's
 * token request never arrived inside that window. The code is single-use and
 * PKCE-bound, so its lifetime is not what protects it -- binding is -- and
 * RFC 6749 section 4.1.2 recommends a maximum of ten minutes. Five gives a
 * real browser redirect and a third-party backend room to complete while
 * staying well inside the guidance.
 */
export const AUTH_CODE_TTL_MS = 5 * 60 * 1000

export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** OTP policy for the consent screen. */
export const OTP_TTL_MS = 10 * 60 * 1000
export const OTP_COOLDOWN_MS = 45 * 1000
export const OTP_MAX_ATTEMPTS = 5

export const MCP_PATHS = {
  resource: '/api/mcp',
  authorize: '/api/mcp/oauth/authorize',
  token: '/api/mcp/oauth/token',
  register: '/api/mcp/oauth/register',
  revoke: '/api/mcp/oauth/revoke',
  consentPage: '/mcp/authorize',
} as const

/**
 * Redirect URI hosts a client may register.
 *
 * Dynamic client registration is open by design -- it has no credential, so
 * anybody can POST to it. What stops that mattering is this list: a registered
 * client can only ever receive an authorization code at a ChatGPT callback, so
 * a rogue registration has nowhere to send the code it would need.
 *
 * Exact hosts and one suffix rule, not a regex over the whole URL: a pattern
 * like /chatgpt\.com/ would also match `chatgpt.com.evil.test`.
 */
const ALLOWED_REDIRECT_HOSTS = new Set([
  'chatgpt.com',
  'chat.openai.com',
  'platform.openai.com',
])

const ALLOWED_REDIRECT_HOST_SUFFIX = '.chatgpt.com'

export function isAllowedRedirectUri(uri: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(uri)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:') return false
  // Credentials or a fragment in a redirect URI are both signs of something
  // other than an ordinary OAuth callback, and RFC 6749 forbids the fragment.
  if (parsed.username || parsed.password || parsed.hash) return false

  const host = parsed.hostname.toLowerCase()
  return ALLOWED_REDIRECT_HOSTS.has(host) || host.endsWith(ALLOWED_REDIRECT_HOST_SUFFIX)
}

/**
 * The canonical public origin, which doubles as the OAuth issuer.
 *
 * Must be exact and stable: the issuer string in the metadata document is
 * compared by the client, and a trailing slash or a preview-deployment hostname
 * here is a confusing authorization failure rather than an obvious one.
 */
export function getIssuer(): string {
  const raw =
    process.env.MCP_OAUTH_ISSUER ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL

  if (!raw) {
    throw new Error(
      'MCP_OAUTH_ISSUER (or NEXT_PUBLIC_SITE_URL) must be set for the MCP OAuth endpoints.'
    )
  }
  return raw.replace(/\/+$/, '')
}

export function getResourceIdentifier(): string {
  return `${getIssuer()}${MCP_PATHS.resource}`
}

export function absoluteUrl(path: string): string {
  return `${getIssuer()}${path}`
}

/**
 * Compare a client-supplied RFC 8707 `resource` against our own identifier.
 *
 * ChatGPT appends this to both the authorize and token requests. Checking it
 * is what stops a token minted for some other audience being replayed at this
 * endpoint; a trailing slash is tolerated because clients differ on it.
 */
export function resourceMatches(candidate: string | null | undefined): boolean {
  if (!candidate) return false
  const normalize = (value: string) => value.replace(/\/+$/, '').toLowerCase()
  return normalize(candidate) === normalize(getResourceIdentifier())
}

/** Scopes requested by the client, narrowed to what we are willing to grant. */
export function negotiateScopes(requested: string | null | undefined): string[] {
  if (!requested?.trim()) {
    // A client that asks for nothing gets read access only. Silently granting
    // write to an unscoped request would make the scope system decorative.
    return [SCOPE_CONTENT_READ]
  }

  const asked = requested.split(/\s+/).filter(Boolean)
  const granted = asked.filter((scope) =>
    (GRANTABLE_SCOPES as readonly string[]).includes(scope)
  )

  // Read is implied by write: a client that can edit an article must be able to
  // fetch its conflict token first, and refusing that would make every write a
  // guess.
  if (granted.includes(SCOPE_CONTENT_WRITE) && !granted.includes(SCOPE_CONTENT_READ)) {
    granted.push(SCOPE_CONTENT_READ)
  }

  return granted.length > 0 ? [...new Set(granted)] : [SCOPE_CONTENT_READ]
}
