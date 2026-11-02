import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_IMAGE_BYTES,
  decodeBase64Image,
  fetchRemoteImage,
  isBlockedAddress,
  type ImageImportDeps,
} from '@/lib/mcp/image-fetch'
import { McpValidationError } from '@/lib/mcp/validation'

/**
 * The SSRF guard and the format checks.
 *
 * Network calls are injected, so every blocked range and redirect hop is
 * exercised without reaching the real network -- a test that had to actually
 * try 169.254.169.254 would be slow and would pass for the wrong reason
 * whenever the connection simply failed.
 */

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
])
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)])

/** Deps that resolve every hostname to a public address and serve one image. */
function deps(overrides: Partial<ImageImportDeps> = {}): ImageImportDeps {
  return {
    lookup: async () => [{ address: '93.184.216.34' }],
    fetch: async () =>
      new Response(new Uint8Array(PNG), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    ...overrides,
  }
}

async function rejectsAsync(fn: () => Promise<unknown>, match: RegExp): Promise<void> {
  try {
    await fn()
  } catch (error) {
    assert.ok(error instanceof McpValidationError, `expected McpValidationError, got ${error}`)
    assert.match(error.errors.join(' '), match)
    return
  }
  assert.fail(`expected a rejection matching ${match}, but the call succeeded`)
}

// ── Address classification ─────────────────────────────────────────────────

test('the cloud metadata address is blocked', () => {
  // The one that matters most: on a compromised fetch it hands out instance
  // credentials.
  assert.equal(isBlockedAddress('169.254.169.254'), true)
})

test('loopback, private, link-local, CGNAT and reserved ranges are blocked', () => {
  for (const ip of [
    '127.0.0.1',
    '127.1.2.3',
    '0.0.0.0',
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '192.168.1.1',
    '192.0.0.1',
    '169.254.1.1',
    '100.64.0.1',
    '100.127.255.255',
    '198.18.0.1',
    '198.19.0.1',
    '224.0.0.1',
    '239.255.255.255',
    '255.255.255.255',
  ]) {
    assert.equal(isBlockedAddress(ip), true, `${ip} must be blocked`)
  }
})

test('public addresses just outside each blocked range are allowed', () => {
  // Confirms the boundaries are not off by one in the permissive direction.
  for (const ip of [
    '93.184.216.34',
    '1.1.1.1',
    '8.8.8.8',
    '172.15.255.255',
    '172.32.0.1',
    '192.167.255.255',
    '192.169.0.1',
    '100.63.255.255',
    '100.128.0.1',
    '169.253.255.255',
    '11.0.0.1',
    '126.255.255.255',
    '128.0.0.1',
  ]) {
    assert.equal(isBlockedAddress(ip), false, `${ip} should be allowed`)
  }
})

test('IPv6 loopback, link-local, unique-local and multicast are blocked', () => {
  for (const ip of ['::', '::1', 'fe80::1', 'fd00::1', 'fc00::1', 'ff02::1']) {
    assert.equal(isBlockedAddress(ip), true, `${ip} must be blocked`)
  }
})

test('an IPv4-mapped IPv6 address cannot smuggle a private address through', () => {
  assert.equal(isBlockedAddress('::ffff:127.0.0.1'), true)
  assert.equal(isBlockedAddress('::ffff:169.254.169.254'), true)
  assert.equal(isBlockedAddress('::ffff:10.0.0.1'), true)
})

test('anything that is not a parseable address is blocked', () => {
  for (const value of ['', 'localhost', 'not-an-ip', '1.2.3', '1.2.3.4.5', '999.1.1.1']) {
    assert.equal(isBlockedAddress(value), true, `${value} must be blocked`)
  }
})

// ── URL scheme and shape ───────────────────────────────────────────────────

test('non-https schemes are refused', async () => {
  for (const url of [
    'http://example.com/a.png',
    'file:///etc/passwd',
    'data:image/png;base64,AAAA',
    'gopher://example.com/',
    'ftp://example.com/a.png',
  ]) {
    await rejectsAsync(() => fetchRemoteImage(url, deps()), /https/)
  }
})

test('a URL with embedded credentials is refused', async () => {
  await rejectsAsync(
    () => fetchRemoteImage('https://user:pass@example.com/a.png', deps()),
    /credentials/
  )
})

test('a non-default port is refused', async () => {
  await rejectsAsync(
    () => fetchRemoteImage('https://example.com:8443/a.png', deps()),
    /default https port/
  )
})

test('a malformed URL is refused', async () => {
  await rejectsAsync(() => fetchRemoteImage('not a url', deps()), /valid URL/)
})

// ── DNS-based blocking ─────────────────────────────────────────────────────

test('a hostname resolving to an internal address is refused', async () => {
  // This is the rebinding case: the name looks fine, the address does not.
  await rejectsAsync(
    () =>
      fetchRemoteImage(
        'https://totally-innocent.test/a.png',
        deps({ lookup: async () => [{ address: '169.254.169.254' }] })
      ),
    /private or reserved/
  )
})

test('a hostname with both a public and a private record is refused', async () => {
  // Any answer being internal must fail, not just the first one.
  await rejectsAsync(
    () =>
      fetchRemoteImage(
        'https://split-horizon.test/a.png',
        deps({
          lookup: async () => [{ address: '93.184.216.34' }, { address: '127.0.0.1' }],
        })
      ),
    /private or reserved/
  )
})

test('a literal internal IP in the URL is refused without a DNS lookup', async () => {
  let looked = false
  await rejectsAsync(
    () =>
      fetchRemoteImage(
        'https://169.254.169.254/latest/meta-data/',
        deps({
          lookup: async () => {
            looked = true
            return [{ address: '93.184.216.34' }]
          },
        })
      ),
    /private or reserved/
  )
  assert.equal(looked, false, 'a literal address needs no lookup and must not get one')
})

test('a hostname that does not resolve is refused', async () => {
  await rejectsAsync(
    () =>
      fetchRemoteImage(
        'https://nowhere.test/a.png',
        deps({
          lookup: async () => {
            throw new Error('ENOTFOUND')
          },
        })
      ),
    /could not be resolved/
  )
})

test('a hostname with no addresses is refused', async () => {
  await rejectsAsync(
    () => fetchRemoteImage('https://empty.test/a.png', deps({ lookup: async () => [] })),
    /no addresses/
  )
})

// ── Redirects ──────────────────────────────────────────────────────────────

test('a redirect to an internal address is refused at the second hop', async () => {
  // The reason redirect: 'manual' is used. With 'follow', undici would resolve
  // this hop internally, past every check above.
  const hosts: string[] = []
  await rejectsAsync(
    () =>
      fetchRemoteImage(
        'https://public.test/a.png',
        deps({
          lookup: async (hostname) => {
            hosts.push(hostname)
            return hostname === 'public.test'
              ? [{ address: '93.184.216.34' }]
              : [{ address: '169.254.169.254' }]
          },
          fetch: async (input) => {
            if (String(input).includes('public.test')) {
              return new Response(null, {
                status: 302,
                headers: { location: 'https://internal.test/meta' },
              })
            }
            return new Response(new Uint8Array(PNG), {
              status: 200,
              headers: { 'content-type': 'image/png' },
            })
          },
        })
      ),
    /private or reserved/
  )
  assert.deepEqual(hosts, ['public.test', 'internal.test'], 'each hop must be re-resolved')
})

test('a redirect chain that is too long is refused', async () => {
  await rejectsAsync(
    () =>
      fetchRemoteImage(
        'https://loop.test/a',
        deps({
          fetch: async () =>
            new Response(null, { status: 302, headers: { location: 'https://loop.test/b' } }),
        })
      ),
    /redirected too many times/
  )
})

test('a redirect with no Location is refused', async () => {
  await rejectsAsync(
    () =>
      fetchRemoteImage(
        'https://x.test/a',
        deps({ fetch: async () => new Response(null, { status: 302 }) })
      ),
    /no destination/
  )
})

test('a redirect downgrading to http is refused', async () => {
  await rejectsAsync(
    () =>
      fetchRemoteImage(
        'https://x.test/a',
        deps({
          fetch: async () =>
            new Response(null, { status: 302, headers: { location: 'http://x.test/b' } }),
        })
      ),
    /https/
  )
})

// ── Content type and size ──────────────────────────────────────────────────

test('a non-image content type is refused', async () => {
  for (const contentType of ['text/html', 'application/pdf', 'image/svg+xml', 'application/json']) {
    await rejectsAsync(
      () =>
        fetchRemoteImage(
          'https://x.test/a',
          deps({
            fetch: async () =>
              new Response(new Uint8Array(PNG), {
                status: 200,
                headers: { 'content-type': contentType },
              }),
          })
        ),
      /Allowed/
    )
  }
})

test('SVG is refused even though it is an image', async () => {
  // It is a script-execution vector served from our own origin.
  await rejectsAsync(
    () =>
      fetchRemoteImage(
        'https://x.test/a.svg',
        deps({
          fetch: async () =>
            new Response('<svg onload="alert(1)"/>', {
              status: 200,
              headers: { 'content-type': 'image/svg+xml' },
            }),
        })
      ),
    /Allowed/
  )
})

test('an over-size declared length is refused before download', async () => {
  await rejectsAsync(
    () =>
      fetchRemoteImage(
        'https://x.test/big.png',
        deps({
          fetch: async () =>
            new Response(new Uint8Array(PNG), {
              status: 200,
              headers: { 'content-type': 'image/png', 'content-length': String(50 * 1024 * 1024) },
            }),
        })
      ),
    /maximum/
  )
})

test('an over-size body is refused even when the header lied', async () => {
  const huge = Buffer.concat([PNG, Buffer.alloc(9 * 1024 * 1024)])
  await rejectsAsync(
    () =>
      fetchRemoteImage(
        'https://x.test/big.png',
        deps({
          fetch: async () =>
            new Response(new Uint8Array(huge), {
              status: 200,
              headers: { 'content-type': 'image/png', 'content-length': '100' },
            }),
        })
      ),
    /maximum/
  )
})

test('an empty body is refused', async () => {
  await rejectsAsync(
    () =>
      fetchRemoteImage(
        'https://x.test/a.png',
        deps({
          fetch: async () =>
            new Response(new Uint8Array(0), {
              status: 200,
              headers: { 'content-type': 'image/png' },
            }),
        })
      ),
    /empty/
  )
})

test('an HTTP error is reported with the Drive hint', async () => {
  // The most likely real failure: a Drive link that is not publicly shared.
  await rejectsAsync(
    () =>
      fetchRemoteImage(
        'https://drive.google.com/file/d/x',
        deps({ fetch: async () => new Response('denied', { status: 403 }) })
      ),
    /Google Drive/
  )
})

test('a file whose contents contradict its declared type is refused', async () => {
  // Content-Type is a claim. These files are served from our own origin, so a
  // mislabelled HTML document would be an XSS vector.
  await rejectsAsync(
    () =>
      fetchRemoteImage(
        'https://x.test/fake.png',
        deps({
          fetch: async () =>
            new Response('<html><script>alert(1)</script></html>', {
              status: 200,
              headers: { 'content-type': 'image/png' },
            }),
        })
      ),
    /do not match the declared type/
  )
})

test('a well-formed remote image is accepted', async () => {
  const result = await fetchRemoteImage('https://cdn.test/a.png', deps())
  assert.equal(result.contentType, 'image/png')
  assert.ok(result.bytes.byteLength > 0)
})

// ── base64 path ────────────────────────────────────────────────────────────

test('a valid base64 PNG is decoded', () => {
  const result = decodeBase64Image(PNG.toString('base64'), 'image/png')
  assert.equal(result.contentType, 'image/png')
  assert.equal(result.bytes.byteLength, PNG.byteLength)
})

test('a data URL carries its own mime type', () => {
  const result = decodeBase64Image(
    `data:image/jpeg;base64,${JPEG.toString('base64')}`,
    undefined
  )
  assert.equal(result.contentType, 'image/jpeg')
})

test('a missing or disallowed mime type is refused', () => {
  assert.throws(() => decodeBase64Image(PNG.toString('base64'), undefined), McpValidationError)
  assert.throws(
    () => decodeBase64Image(PNG.toString('base64'), 'image/svg+xml'),
    McpValidationError
  )
  assert.throws(
    () => decodeBase64Image(PNG.toString('base64'), 'application/pdf'),
    McpValidationError
  )
})

test('base64 larger than the inline cap is refused with the sourceUrl hint', () => {
  const huge = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES)])
  try {
    decodeBase64Image(huge.toString('base64'), 'image/png')
    assert.fail('expected a rejection')
  } catch (error) {
    assert.ok(error instanceof McpValidationError)
    assert.match(error.errors[0], /sourceUrl/)
  }
})

test('non-base64 input is refused', () => {
  assert.throws(() => decodeBase64Image('not base64 !!!', 'image/png'), McpValidationError)
  assert.throws(() => decodeBase64Image('', 'image/png'), McpValidationError)
})

test('base64 whose bytes contradict the declared type is refused', () => {
  const html = Buffer.from('<html><script>alert(1)</script></html>')
  assert.throws(() => decodeBase64Image(html.toString('base64'), 'image/png'), McpValidationError)
})

test('the inline cap leaves room under the 4.5 MB platform body limit', () => {
  // base64 inflates by a third; 3 MB of image is about 4 MB on the wire.
  const onWire = MAX_IMAGE_BYTES * (4 / 3)
  assert.ok(onWire < 4.5 * 1024 * 1024, 'the cap must stay below the Vercel body limit')
})
