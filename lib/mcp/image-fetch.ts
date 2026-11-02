/**
 * Fetching and validating an article image: the SSRF guard, the size caps and
 * the format checks.
 *
 * Split out of image-import.ts, which owns the Firebase Storage write, so that
 * none of this needs `server-only`. That is not cosmetic -- the project's test
 * runner is plain node:test through tsx, where importing a `server-only`
 * module throws, so a guard living beside the Storage client would be
 * untestable. This is the half worth testing hardest, and now it can be.
 *
 * Nothing here touches Firebase, Prisma or any credential.
 */

import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import { McpValidationError } from '@/lib/mcp/validation'

/**
 * Getting an article image into Firebase Storage, from either a base64 payload
 * or a public URL.
 *
 * Both paths converge on the same validated, content-addressed write, so there
 * is one place that decides what may be stored and where.
 */

/**
 * 3 MB of actual image bytes.
 *
 * Vercel caps a serverless function's request body at 4.5 MB, and base64
 * inflates by a third -- so 3 MB of image is about 4 MB on the wire, leaving
 * room for the rest of the JSON-RPC envelope. A larger cap would not fail
 * here, it would fail at the platform with an error the client cannot
 * interpret.
 */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024

/** Remote fetches are not body-limited, but an unbounded download is its own problem. */
export const MAX_REMOTE_IMAGE_BYTES = 8 * 1024 * 1024

const REMOTE_FETCH_TIMEOUT_MS = 10_000

/**
 * Injection seam for the two network calls.
 *
 * Only so the SSRF guard can be tested. There is no point asserting that
 * 169.254.169.254 is refused if the test has to reach the real network to find
 * out -- a test like that is slow, flaky, and silently passes if the fetch
 * fails for an unrelated reason. With these injected, every blocked range and
 * every redirect hop is exercised deterministically.
 *
 * Production never passes them, so the defaults are the real implementations
 * and there is no way to disable the guard through this seam.
 */
export interface ImageImportDeps {
  fetch: typeof globalThis.fetch
  lookup: (hostname: string) => Promise<{ address: string }[]>
}

const DEFAULT_DEPS: ImageImportDeps = {
  fetch: (...args) => globalThis.fetch(...args),
  lookup: (hostname) => dnsLookup(hostname, { all: true }),
}

/**
 * Formats the storefront can actually serve.
 *
 * next.config.ts converts to AVIF and WebP on the fly, so the stored format
 * only has to be something sharp-free Next can read. SVG is excluded
 * deliberately: it is a script-execution vector served from our own origin, and
 * no article needs one.
 */
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
}

export interface FetchedImage {
  bytes: Buffer
  contentType: string
}

/** File extension to store each accepted type under. */
export function extensionFor(contentType: string): string | undefined {
  return ALLOWED_MIME[contentType]
}

// ── SSRF guard ─────────────────────────────────────────────────────────────

/**
 * Address ranges a server-side fetch must never reach.
 *
 * The cloud metadata endpoint (169.254.169.254) is the one that matters most:
 * on a compromised fetch it hands out instance credentials. The rest close the
 * ordinary internal-network paths. Checked against the *resolved* address, not
 * the hostname, because a hostname tells you nothing -- an attacker controls
 * their own DNS and can point any name at 127.0.0.1.
 */
function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true
  }
  const [a, b] = parts

  if (a === 0) return true // "this network"
  if (a === 10) return true // private
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true // private
  if (a === 192 && b === 168) return true // private
  if (a === 192 && b === 0) return true // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  if (a >= 224) return true // multicast and reserved
  return false
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '')

  if (lower === '::' || lower === '::1') return true // unspecified, loopback
  if (lower.startsWith('fe8') || lower.startsWith('fe9')) return true // link-local
  if (lower.startsWith('fea') || lower.startsWith('feb')) return true // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // unique local
  if (lower.startsWith('ff')) return true // multicast

  // ::ffff:a.b.c.d — an IPv4 address wearing an IPv6 costume, which would
  // otherwise slip past every check above.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower)
  if (mapped) return isBlockedIpv4(mapped[1])
  // And the hex form of the same thing.
  if (lower.startsWith('::ffff:')) return true

  return false
}

export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return isBlockedIpv4(ip)
  if (version === 6) return isBlockedIpv6(ip)
  return true // not an address we can reason about
}

/**
 * Resolve a hostname and refuse it if any answer is internal.
 *
 * *Any*, not "the first": a name with both a public and a private A record
 * would otherwise be allowed on whichever record happened to come back first.
 */
async function assertPublicHost(hostname: string, deps: ImageImportDeps): Promise<string> {
  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new McpValidationError('INVALID_REQUEST', [
        'sourceUrl points at a private or reserved address.',
      ])
    }
    return hostname
  }

  let answers: { address: string }[]
  try {
    answers = await deps.lookup(hostname)
  } catch {
    throw new McpValidationError('INVALID_REQUEST', [
      `sourceUrl host "${hostname}" could not be resolved.`,
    ])
  }

  if (answers.length === 0) {
    throw new McpValidationError('INVALID_REQUEST', [
      `sourceUrl host "${hostname}" has no addresses.`,
    ])
  }

  for (const answer of answers) {
    if (isBlockedAddress(answer.address)) {
      console.warn('[MCP_IMAGE_IMPORT] Blocked internal address for host:', hostname)
      throw new McpValidationError('INVALID_REQUEST', [
        'sourceUrl resolves to a private or reserved address and will not be fetched.',
      ])
    }
  }

  return answers[0].address
}

function assertFetchableUrl(raw: string): URL {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new McpValidationError('INVALID_REQUEST', ['sourceUrl is not a valid URL.'])
  }

  // HTTPS only. Plain http is both a downgrade and the easiest way to reach an
  // internal service that never bothered with a certificate.
  if (parsed.protocol !== 'https:') {
    throw new McpValidationError('INVALID_REQUEST', [
      'sourceUrl must be an https URL. http, file, data, gopher and other schemes are refused.',
    ])
  }
  if (parsed.username || parsed.password) {
    throw new McpValidationError('INVALID_REQUEST', [
      'sourceUrl must not embed credentials.',
    ])
  }
  // A non-standard port on an https URL is almost always an internal service.
  if (parsed.port && parsed.port !== '443') {
    throw new McpValidationError('INVALID_REQUEST', [
      'sourceUrl must use the default https port.',
    ])
  }

  return parsed
}

/**
 * Fetch a remote image under every constraint at once.
 *
 * Redirects are handled manually rather than followed. `redirect: 'follow'`
 * would re-resolve each hop inside undici, past all the checks above -- so a
 * public URL that 302s to 169.254.169.254 would sail through. Each hop is
 * therefore re-validated from scratch, and the chain is capped.
 */
export async function fetchRemoteImage(
  sourceUrl: string,
  deps: ImageImportDeps
): Promise<{ bytes: Buffer; contentType: string }> {
  let current = assertFetchableUrl(sourceUrl)

  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(current.hostname, deps)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS)

    let response: Response
    try {
      response = await deps.fetch(current.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: 'image/*' },
      })
    } catch {
      clearTimeout(timer)
      throw new McpValidationError('INVALID_REQUEST', [
        `Could not fetch sourceUrl (network error or timeout after ${REMOTE_FETCH_TIMEOUT_MS}ms).`,
      ])
    }
    clearTimeout(timer)

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) {
        throw new McpValidationError('INVALID_REQUEST', [
          'sourceUrl returned a redirect with no destination.',
        ])
      }
      current = assertFetchableUrl(new URL(location, current).toString())
      continue
    }

    if (!response.ok) {
      throw new McpValidationError('INVALID_REQUEST', [
        `sourceUrl returned HTTP ${response.status}. The image must be publicly reachable — ` +
          'a Google Drive link is not, unless the file is shared with "anyone with the link".',
      ])
    }

    const contentType = (response.headers.get('content-type') ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase()

    if (!ALLOWED_MIME[contentType]) {
      throw new McpValidationError('INVALID_REQUEST', [
        `sourceUrl served "${contentType || 'an unknown type'}". Allowed: ${Object.keys(ALLOWED_MIME).join(', ')}.`,
      ])
    }

    // Trust the declared length only to fail early; the real limit is enforced
    // against the bytes actually received, since the header can lie.
    const declared = Number(response.headers.get('content-length') ?? '0')
    if (declared > MAX_REMOTE_IMAGE_BYTES) {
      throw new McpValidationError('INVALID_REQUEST', [
        `The image is ${Math.round(declared / 1024 / 1024)} MB; the maximum is ` +
          `${MAX_REMOTE_IMAGE_BYTES / 1024 / 1024} MB.`,
      ])
    }

    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength > MAX_REMOTE_IMAGE_BYTES) {
      throw new McpValidationError('INVALID_REQUEST', [
        `The image is ${Math.round(bytes.byteLength / 1024 / 1024)} MB; the maximum is ` +
          `${MAX_REMOTE_IMAGE_BYTES / 1024 / 1024} MB.`,
      ])
    }
    if (bytes.byteLength === 0) {
      throw new McpValidationError('INVALID_REQUEST', ['sourceUrl returned an empty body.'])
    }

    assertMagicBytesMatch(bytes, contentType)
    return { bytes, contentType }
  }

  throw new McpValidationError('INVALID_REQUEST', ['sourceUrl redirected too many times.'])
}

/**
 * Check the file's own header against its declared type.
 *
 * A Content-Type header or a base64 `mimeType` argument is just a claim. Since
 * these files end up served from our own origin, a mislabelled one is an XSS
 * vector -- an HTML document uploaded as image/png would be sniffed as HTML by
 * some clients. The magic bytes are the one part a caller cannot simply assert.
 */
function assertMagicBytesMatch(bytes: Buffer, contentType: string): void {
  const matches = (() => {
    switch (contentType) {
      case 'image/jpeg':
      case 'image/jpg':
        return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      case 'image/png':
        return (
          bytes[0] === 0x89 &&
          bytes[1] === 0x50 &&
          bytes[2] === 0x4e &&
          bytes[3] === 0x47
        )
      case 'image/gif':
        return bytes.subarray(0, 3).toString('ascii') === 'GIF'
      case 'image/webp':
        return (
          bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
          bytes.subarray(8, 12).toString('ascii') === 'WEBP'
        )
      case 'image/avif':
        // ISO-BMFF: bytes 4-8 are the 'ftyp' box, then the brand.
        return bytes.subarray(4, 8).toString('ascii') === 'ftyp'
      default:
        return false
    }
  })()

  if (!matches) {
    throw new McpValidationError('INVALID_REQUEST', [
      `The file's contents do not match the declared type "${contentType}". ` +
        'It is not a valid image of that format.',
    ])
  }
}

/** Decode and validate an inline base64 payload. */
export function decodeBase64Image(
  imageBase64: string,
  declaredType: string | undefined
): { bytes: Buffer; contentType: string } {
  // Tolerate a data: URL, which is what a client will often produce.
  // [\s\S] rather than the `s` flag: the project's TS target predates es2018.
  const dataUrl = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([\s\S]*)$/i.exec(imageBase64.trim())
  const payload = dataUrl ? dataUrl[2] : imageBase64.trim()
  const contentType = (dataUrl?.[1] ?? declaredType ?? '').toLowerCase()

  if (!ALLOWED_MIME[contentType]) {
    throw new McpValidationError('INVALID_REQUEST', [
      `mimeType must be one of ${Object.keys(ALLOWED_MIME).join(', ')}; got "${contentType || 'nothing'}".`,
    ])
  }

  if (!/^[A-Za-z0-9+/\r\n=]+$/.test(payload)) {
    throw new McpValidationError('INVALID_REQUEST', ['imageBase64 is not valid base64.'])
  }

  const bytes = Buffer.from(payload, 'base64')
  if (bytes.byteLength === 0) {
    throw new McpValidationError('INVALID_REQUEST', ['imageBase64 decoded to zero bytes.'])
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new McpValidationError('INVALID_REQUEST', [
      `The decoded image is ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB; the inline ` +
        `maximum is ${MAX_IMAGE_BYTES / 1024 / 1024} MB. Use sourceUrl for a larger file.`,
    ])
  }

  assertMagicBytesMatch(bytes, contentType)
  return { bytes, contentType }
}

export { DEFAULT_DEPS }
