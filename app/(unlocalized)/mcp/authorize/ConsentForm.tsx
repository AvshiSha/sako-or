'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Email -> code -> consent, in three steps on one page.
 *
 * No Firebase sign-in happens here, which is the point. The admin login page
 * has to call signInWithEmailAndPassword in the browser because the client
 * Firebase keys are referrer-restricted and admin pages then write to Firestore
 * through the client SDK. None of that applies to a content editor: she never
 * touches Firestore from a browser, so verifying the code server-side and
 * attaching the result to the pending authorization request is both simpler and
 * narrower -- this page leaves her with no session on the site at all, only an
 * authorization code in ChatGPT's hands.
 */

const INPUT_CLASS =
  'block w-full rounded-md border border-[#B2A28E] bg-white px-3 py-2 text-black placeholder-[#B2A28E] focus:border-[#856D55] focus:outline-none focus:ring-1 focus:ring-[#856D55] sm:text-sm'

const BUTTON_CLASS =
  'flex w-full items-center justify-center rounded-md border border-transparent bg-[#856D55] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#95816C] focus:outline-none focus:ring-2 focus:ring-[#856D55] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

const SECONDARY_BUTTON_CLASS =
  'flex w-full items-center justify-center rounded-md border border-[#B2A28E] bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition-colors hover:bg-[#E1DBD7]/50 focus:outline-none focus:ring-2 focus:ring-[#856D55] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

type Step = 'email' | 'code' | 'consent'

/** Plain-English descriptions of what each scope actually permits. */
const SCOPE_LABELS: Record<string, string> = {
  'content:read': 'Read blog articles and category SEO text',
  'content:write': 'Create and edit blog drafts, category SEO text, and upload article images',
  offline_access: 'Stay connected without signing in again',
}

export default function ConsentForm() {
  const searchParams = useSearchParams()
  const requestId = searchParams?.get('request') ?? ''

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [scopes, setScopes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (!requestId) {
    return (
      <p className="text-sm text-red-600">
        This link is missing its authorization request. Start the connection again from ChatGPT.
      </p>
    )
  }

  async function post(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
    return { ok: response.ok, data }
  }

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')

    const { ok, data } = await post('/api/mcp/oauth/otp', {
      action: 'send',
      request: requestId,
      email,
    })

    setBusy(false)
    if (!ok) {
      setError(typeof data.message === 'string' ? data.message : 'Could not send the code.')
      return
    }
    setNotice('Check your inbox for a six-digit code. It is valid for ten minutes.')
    setStep('code')
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')

    const { ok, data } = await post('/api/mcp/oauth/otp', {
      action: 'verify',
      request: requestId,
      email,
      code,
    })

    setBusy(false)
    if (!ok) {
      setError(typeof data.message === 'string' ? data.message : 'That code did not work.')
      return
    }
    setScopes(Array.isArray(data.scopes) ? (data.scopes as string[]) : [])
    setStep('consent')
  }

  // Approve and Deny are a plain form POST to /api/mcp/oauth/approve, which
  // answers with a 303 to the client's callback. No fetch, no
  // `window.location.href`, no JavaScript in the path at all.
  //
  // The first real ChatGPT connection failed exactly here: consent succeeded
  // and the code was issued, but the browser never reached the callback
  // ChatGPT was watching, so the token was never requested and the connector
  // ended up with no credential. A server redirect from a form submission is
  // what every other OAuth consent screen does and what clients are built
  // against.

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="rounded-md border border-[#B2A28E]/40 bg-[#E1DBD7]/40 px-4 py-3 text-sm text-[#856D55]">
          {notice}
        </div>
      )}

      {step === 'email' && (
        <form className="space-y-4" onSubmit={sendCode}>
          <div>
            <label htmlFor="mcp-email" className="block text-sm font-medium text-black">
              Your SAKO-OR content email
            </label>
            <input
              id="mcp-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`mt-1 ${INPUT_CLASS}`}
            />
          </div>
          <button type="submit" disabled={busy || !email} className={BUTTON_CLASS}>
            {busy ? 'Sending…' : 'Send me a code'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form className="space-y-4" onSubmit={verifyCode}>
          <div>
            <label htmlFor="mcp-code" className="block text-sm font-medium text-black">
              Six-digit code
            </label>
            <input
              id="mcp-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className={`mt-1 text-center text-lg tracking-[0.5em] ${INPUT_CLASS}`}
            />
          </div>
          <button type="submit" disabled={busy || code.length !== 6} className={BUTTON_CLASS}>
            {busy ? 'Checking…' : 'Verify'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => sendCode()}
            className={SECONDARY_BUTTON_CLASS}
          >
            Send a new code
          </button>
        </form>
      )}

      {step === 'consent' && (
        <div className="space-y-5">
          <div>
            <p className="text-sm text-black">
              Allow <strong>ChatGPT</strong> to act on the SAKO-OR website as{' '}
              <span dir="ltr" className="font-medium">
                {email}
              </span>
              ?
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[#856D55]">
              {scopes.map((scope) => (
                <li key={scope} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{SCOPE_LABELS[scope] ?? scope}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Stated plainly, because the whole point of the integration's design
              is that approving this does not hand over a publish button. */}
          <p className="rounded-md border border-[#B2A28E]/40 bg-[#E1DBD7]/40 px-4 py-3 text-xs leading-relaxed text-[#856D55]">
            ChatGPT cannot publish anything directly. It can create and edit drafts and
            schedule them; a scheduled article goes live at its chosen time. It cannot reach
            products, prices, stock, orders, customers, coupons or site settings.
          </p>

          <form method="POST" action="/api/mcp/oauth/approve" className="space-y-3">
            <input type="hidden" name="request" value={requestId} />
            <button type="submit" name="decision" value="approve" className={BUTTON_CLASS}>
              Approve
            </button>
            <button type="submit" name="decision" value="deny" className={SECONDARY_BUTTON_CLASS}>
              Deny
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
