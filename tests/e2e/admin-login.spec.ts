import { test, expect, request as playwrightRequest } from '@playwright/test'

/**
 * Admin access control, added 2026-10-17 alongside the admin security work.
 *
 * What these lock down:
 *
 * - **Admin pages had no server-side gate at all.** `middleware.ts` is locale
 *   routing and passed `/admin` straight through; the only guard was
 *   `ProtectedRoute`, a client component whose redirect runs in a useEffect.
 *   The HTML and JS of every admin page were therefore served to anyone who
 *   asked for them. There are now two server layers — a cookie-presence check
 *   in middleware and an authoritative `verifySessionCookie` in the admin
 *   layout — and these tests pin both.
 * - **Turnstile on the admin login was unenforceable.** The page called
 *   `signInWithEmailAndPassword` directly from the browser to Google, so the
 *   server never saw a login attempt. Credentials now go through
 *   `POST /api/admin/login`, which verifies Turnstile *before* it looks at the
 *   password. The forged-token case below is the regression guard for that.
 *
 * ## What is not covered here, and why
 *
 * The signed-in happy path needs a real admin password and a solvable
 * Turnstile widget. Unlike the other specs in this directory, that cannot be
 * stubbed: the whole point of the change is that the credential check happens
 * server-side against Google, so intercepting it locally would assert nothing.
 *
 * To run the full flow manually, build with Cloudflare's always-pass test keys
 * so the widget auto-solves and the real verifier still runs end to end:
 *
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA \
 *   TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA \
 *   npm run build && PORT=3002 npm run start
 *
 * Do NOT use TURNSTILE_DEV_BYPASS for this. A bypass flag that QA depends on
 * is a bypass flag that eventually ships.
 */

const PROTECTED_PATHS = ['/admin', '/admin/products', '/admin/users', '/admin/coupons']

test.describe('admin pages are gated server-side', () => {
  for (const path of PROTECTED_PATHS) {
    test(`${path} redirects to the login page when signed out`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' })

      expect(response, `no response for ${path}`).not.toBeNull()
      await expect(page).toHaveURL(/\/admin\/login/)

      // The originally requested path is preserved so the login can return
      // the admin to where they were going.
      expect(new URL(page.url()).searchParams.get('from')).toBe(path)
    })
  }

  test('a forged session cookie serves no admin content', async ({ page, context, baseURL }) => {
    // Middleware only checks that the cookie is PRESENT — it runs on the Edge
    // and cannot verify a Firebase session cookie. This asserts the second
    // layer, the Node layout, actually rejects a cookie that merely exists.
    const url = new URL(baseURL!)
    await context.addCookies([
      {
        name: url.protocol === 'https:' ? '__Host-sako_admin' : 'sako_admin_dev',
        value: 'forged-not-a-real-session-cookie',
        domain: url.hostname,
        path: '/',
      },
    ])

    await page.goto('/admin', { waitUntil: 'domcontentloaded' })

    // The admin shell renders the "SAKO OR" wordmark in its header; it must
    // not appear for a forged credential, whether or not the redirect has
    // finished by the time this runs.
    const html = await page.content()
    expect(html).not.toContain('AdminShell')
    await expect(page.getByRole('link', { name: 'SAKO OR' })).toHaveCount(0)
  })

  test('the login page itself stays reachable while signed out', async ({ page }) => {
    const response = await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible()
  })
})

test.describe('the login route enforces Turnstile before it trusts anything', () => {
  // The route takes { idToken, turnstileToken }. The password is verified in
  // the browser by signInWithEmailAndPassword, because the Firebase Web API
  // keys are HTTP-referrer restricted and reject a server-side call with
  // 403 "Requests from referer <empty> are blocked". Turnstile still gates
  // the session cookie, which is what /admin actually requires.

  test('a forged Turnstile token is rejected whatever ID token is supplied', async ({ baseURL }) => {
    const api = await playwrightRequest.newContext({ baseURL })

    const post = (idToken: string) =>
      api.post('/api/admin/login', {
        data: { idToken, turnstileToken: 'forged-token' },
        failOnStatusCode: false,
      })

    const a = await post('forged.id.token')
    const b = await post('a-completely-different-forged-token')

    expect(a.status()).toBe(403)
    expect((await a.json()).code).toBe('TURNSTILE_FAILED')

    // Identical verdict for a different token: Turnstile is checked before
    // the ID token is looked at, so this cannot be used to probe tokens.
    expect(b.status()).toBe(403)
    expect((await b.json()).code).toBe('TURNSTILE_FAILED')

    await api.dispose()
  })

  test('a missing Turnstile token is rejected the same way', async ({ baseURL }) => {
    const api = await playwrightRequest.newContext({ baseURL })
    const res = await api.post('/api/admin/login', {
      data: { idToken: 'forged.id.token' },
      failOnStatusCode: false,
    })

    expect(res.status()).toBe(403)
    expect((await res.json()).code).toBe('TURNSTILE_FAILED')
    await api.dispose()
  })

  test('a valid-looking request with no credentials at all is rejected', async ({ baseURL }) => {
    const api = await playwrightRequest.newContext({ baseURL })
    const res = await api.post('/api/admin/login', { data: {}, failOnStatusCode: false })
    expect(res.status()).toBe(400)
    expect((await res.json()).code).toBe('INVALID_REQUEST')
    await api.dispose()
  })

  test('a spoofed Host header does not unlock the development bypass', async ({ baseURL }) => {
    // The OTP endpoint skips Turnstile when the Host header contains
    // "localhost" — and Host is client-controlled, so that check is
    // bypassable. The admin bypass keys off env instead, and additionally
    // requires VERCEL to be unset. This pins the difference.
    const api = await playwrightRequest.newContext({ baseURL })
    const res = await api.post('/api/admin/login', {
      headers: { Host: 'localhost' },
      data: { idToken: 'forged.id.token', turnstileToken: '' },
      failOnStatusCode: false,
    })

    expect(res.status()).toBe(403)
    await api.dispose()
  })
})

test.describe('admin APIs reject every unauthenticated shape', () => {
  const CASES: Array<{ name: string; headers: Record<string, string> }> = [
    { name: 'no credential at all', headers: {} },
    { name: 'a garbage bearer token', headers: { Authorization: 'Bearer garbage' } },
    { name: 'a forged session cookie', headers: { Cookie: '__Host-sako_admin=forged' } },
  ]

  for (const c of CASES) {
    test(`GET /api/admin/users with ${c.name} is 401`, async ({ baseURL }) => {
      const api = await playwrightRequest.newContext({ baseURL })
      const res = await api.get('/api/admin/users', {
        headers: c.headers,
        failOnStatusCode: false,
      })
      expect(res.status()).toBe(401)
      await api.dispose()
    })
  }
})

test.describe('the catalog write APIs are no longer public', () => {
  // These were reachable with no credential of any kind, bypassing the admin
  // login entirely. GET stays public for the storefront.
  test('product create, update and delete all require admin auth', async ({ baseURL }) => {
    const api = await playwrightRequest.newContext({ baseURL })

    const create = await api.post('/api/products', { data: { sku: 'QA-PWN' }, failOnStatusCode: false })
    const update = await api.put('/api/products/anything', { data: {}, failOnStatusCode: false })
    const remove = await api.delete('/api/products/anything', { failOnStatusCode: false })
    const read = await api.get('/api/products', { failOnStatusCode: false })

    expect(create.status()).toBe(401)
    expect(update.status()).toBe(401)
    expect(remove.status()).toBe(401)
    expect(read.status(), 'storefront reads must keep working').toBe(200)

    await api.dispose()
  })

  test('the Google Drive picker endpoints require admin auth', async ({ baseURL }) => {
    const api = await playwrightRequest.newContext({ baseURL })
    for (const path of [
      '/api/google-drive/auth-url',
      '/api/google-drive/auth-status',
      '/api/google-drive/files',
      '/api/google-drive/search',
    ]) {
      const res = await api.get(path, { failOnStatusCode: false })
      expect(res.status(), path).toBe(401)
    }
    await api.dispose()
  })
})
