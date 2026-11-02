import { NextResponse } from 'next/server'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'

import { sendEmailOtp } from '@/lib/email'
import { OTP_COOLDOWN_MS } from '@/lib/mcp/oauth/config'
import { generateOtpCode } from '@/lib/mcp/oauth/crypto'
import {
  consumeOtpCode,
  getAuthRequest,
  getOtpRecord,
  markAuthRequestVerified,
  putOtpRecord,
} from '@/lib/mcp/oauth/store'
import { isMcpEnabled, resolveContentRole } from '@/lib/server/content-role'
import { normalizeEmail } from '@/lib/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Email-OTP sign-in for the MCP consent page.
 *
 * Does NOT reuse /api/auth/send-email-otp. That endpoint keeps codes in a
 * process-global Map, which only works while send and verify land on the same
 * warm serverless instance, generates them with Math.random(), and -- the
 * decisive part -- its verify half *creates a Firebase user* for an unknown
 * address and returns a custom token for the storefront. None of that is
 * appropriate for the one flow that grants an automated client write access to
 * the live site. Only `sendEmailOtp`, the mail template and transport, is
 * shared.
 *
 * The code never establishes a Firebase session. All it does is attach a
 * verified email to one pending authorization request; the OAuth code exchange
 * is what produces a credential, and it re-checks the content role again.
 */

const sendSchema = z.object({
  action: z.literal('send'),
  request: z.string().min(1).max(200),
  email: z.string().trim().email().max(320),
})

const verifySchema = z.object({
  action: z.literal('verify'),
  request: z.string().min(1).max(200),
  email: z.string().trim().email().max(320),
  code: z.string().regex(/^\d{6}$/),
})

const bodySchema = z.discriminatedUnion('action', [sendSchema, verifySchema])

/**
 * One response shape for every failure mode that depends on who is asking.
 *
 * "Not authorized", "no such pending request" and "wrong code" are
 * indistinguishable to the caller on purpose: this page is reachable by anyone
 * who can guess a request id, and telling them whether an address is a
 * registered content editor would turn it into an account oracle. The log line
 * carries the real reason.
 */
function genericFailure(status = 400): NextResponse {
  return NextResponse.json(
    { ok: false, message: 'That did not work. Check the address and code, then try again.' },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: Request) {
  if (!isMcpEnabled()) {
    return new NextResponse(null, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return genericFailure()
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return genericFailure()
  }

  const pending = await getAuthRequest(parsed.data.request)
  if (!pending) {
    console.warn('[MCP_OAUTH_OTP] No pending authorization request for the supplied id.')
    return genericFailure()
  }

  const email = normalizeEmail(parsed.data.email)
  if (!email) return genericFailure()

  // The role check runs before the code is ever sent, so an address that is not
  // a content editor never receives mail from this endpoint. That keeps it from
  // being used to send unsolicited email to arbitrary addresses.
  const role = await resolveContentRole(email)
  if (!role) {
    console.warn('[MCP_OAUTH_OTP] Rejected: address is not a configured content editor.')
    return genericFailure()
  }

  if (parsed.data.action === 'send') {
    const existing = await getOtpRecord(email)
    if (existing) {
      const elapsed = Date.now() - existing.lastSentAt
      if (elapsed < OTP_COOLDOWN_MS) {
        return NextResponse.json(
          {
            ok: false,
            message: `Wait ${Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000)}s before requesting another code.`,
          },
          { status: 429, headers: { 'Cache-Control': 'no-store' } }
        )
      }
    }

    const code = generateOtpCode()
    await putOtpRecord(email, code)

    try {
      await sendEmailOtp({ to: email, otpCode: code, isHebrew: true, brandName: 'SAKO-OR' })
    } catch (error) {
      Sentry.captureException(error, { tags: { route: 'mcp_oauth_otp' } })
      console.error('[MCP_OAUTH_OTP] Failed to send code:', error)
      return NextResponse.json(
        { ok: false, message: 'Could not send the code. Try again in a moment.' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    console.log('[MCP_OAUTH_OTP]', JSON.stringify({ outcome: 'code_sent' }))
    return NextResponse.json(
      { ok: true, message: 'A six-digit code is on its way.' },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const result = await consumeOtpCode(email, parsed.data.code)
  if (!result.ok) {
    console.warn('[MCP_OAUTH_OTP]', JSON.stringify({ outcome: `verify_${result.reason}` }))
    return genericFailure()
  }

  await markAuthRequestVerified(parsed.data.request, email)
  console.log('[MCP_OAUTH_OTP]', JSON.stringify({ outcome: 'verified' }))

  return NextResponse.json(
    {
      ok: true,
      email,
      scopes: pending.scopes,
      clientName: 'ChatGPT',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
