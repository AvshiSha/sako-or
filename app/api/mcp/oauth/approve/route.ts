import { NextResponse } from 'next/server'
import { z } from 'zod'

import { deleteAuthRequest, getAuthRequest, issueAuthCode } from '@/lib/mcp/oauth/store'
import { isMcpEnabled, resolveContentRole } from '@/lib/server/content-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The consent decision.
 *
 * Reached only from the consent page, after the OTP step has attached a
 * verified email to the pending request. The email comes from the stored
 * request, never from this body -- the browser can say which request it is
 * approving, and nothing else.
 *
 * The content role is re-resolved here even though the OTP endpoint already
 * checked it. Between the two calls somebody could have revoked the role, and
 * this is the step that mints a credential: the check belongs where the
 * authority is granted, not only where the identity was proven.
 */
const approveSchema = z
  .object({
    request: z.string().min(1).max(200),
    decision: z.enum(['approve', 'deny']),
  })
  .strict()

export async function POST(request: Request) {
  if (!isMcpEnabled()) {
    return new NextResponse(null, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Malformed request.' }, { status: 400 })
  }

  const parsed = approveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'Malformed request.' }, { status: 400 })
  }

  const pending = await getAuthRequest(parsed.data.request)
  if (!pending) {
    return NextResponse.json(
      { ok: false, message: 'This authorization request has expired. Start again from ChatGPT.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const target = new URL(pending.redirectUri)
  if (pending.state) target.searchParams.set('state', pending.state)

  if (parsed.data.decision === 'deny') {
    await deleteAuthRequest(parsed.data.request)
    target.searchParams.set('error', 'access_denied')
    target.searchParams.set('error_description', 'The user declined the request.')
    console.log('[MCP_OAUTH_APPROVE]', JSON.stringify({ outcome: 'denied' }))
    return NextResponse.json(
      { ok: true, redirectTo: target.toString() },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  if (!pending.verifiedEmail) {
    return NextResponse.json(
      { ok: false, message: 'Verify your email address first.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const role = await resolveContentRole(pending.verifiedEmail)
  if (!role) {
    await deleteAuthRequest(parsed.data.request)
    console.warn('[MCP_OAUTH_APPROVE] Role withdrawn between verification and approval.')
    return NextResponse.json(
      { ok: false, message: 'This account is no longer authorized for content editing.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const code = await issueAuthCode({
    clientId: pending.clientId,
    redirectUri: pending.redirectUri,
    codeChallenge: pending.codeChallenge,
    scopes: pending.scopes,
    resource: pending.resource,
    email: role.email,
  })

  // The pending request is single-use: consumed here so a leaked request id
  // cannot be approved twice to mint a second code.
  await deleteAuthRequest(parsed.data.request)

  target.searchParams.set('code', code)

  console.log(
    '[MCP_OAUTH_APPROVE]',
    JSON.stringify({ outcome: 'approved', scopes: pending.scopes })
  )

  return NextResponse.json(
    { ok: true, redirectTo: target.toString() },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
