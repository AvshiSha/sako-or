import { NextResponse } from 'next/server'
import { z } from 'zod'

import { buildAuthorizationResponse } from '@/lib/mcp/oauth/config'
import { deleteAuthRequest, getAuthRequest, issueAuthCode } from '@/lib/mcp/oauth/store'
import { isMcpEnabled, resolveContentRole } from '@/lib/server/content-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The consent decision.
 *
 * Answers with a **303 redirect** to the client's callback, driven by an
 * ordinary form POST from the consent page. It previously returned JSON and let
 * the page do `window.location.href = …`, and that is how the first real
 * ChatGPT connection failed: consent succeeded and the code was issued, but
 * ChatGPT's token request never arrived, so the browser evidently never landed
 * on the callback it was watching. A server redirect is what every other OAuth
 * consent screen does and what clients are built against; it also removes
 * JavaScript from the one step the whole flow depends on.
 *
 * Reached only after the OTP step has attached a verified email to the pending
 * request. The email comes from the stored request, never from this body -- the
 * browser can say which request it is approving, and nothing else.
 *
 * The content role is re-resolved here even though the OTP endpoint already
 * checked it. Between the two calls somebody could have revoked it, and this is
 * the step that mints a credential: the check belongs where the authority is
 * granted, not only where the identity was proven.
 */
const approveSchema = z
  .object({
    request: z.string().min(1).max(200),
    decision: z.enum(['approve', 'deny']),
  })
  .strict()

/**
 * A failure the user sees in their own browser.
 *
 * Plain text, not JSON: with a form POST this renders in the window, and the
 * person reading it is the specialist, not a program.
 */
function userFacingError(message: string, status: number): NextResponse {
  return new NextResponse(`Authorization could not be completed.\n\n${message}\n`, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

/** 303, so the browser follows with GET rather than re-POSTing to the callback. */
function redirectTo(target: URL): NextResponse {
  return NextResponse.redirect(target.toString(), {
    status: 303,
    headers: { 'Cache-Control': 'no-store' },
  })
}

/** Accepts a form POST, and a JSON body for scripted testing. */
async function readDecision(
  request: Request
): Promise<{ request: string; decision: string } | null> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    try {
      const body = (await request.json()) as Record<string, unknown>
      return {
        request: String(body.request ?? ''),
        decision: String(body.decision ?? ''),
      }
    } catch {
      return null
    }
  }

  try {
    const form = await request.formData()
    return {
      request: String(form.get('request') ?? ''),
      decision: String(form.get('decision') ?? ''),
    }
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  if (!isMcpEnabled()) {
    return new NextResponse(null, { status: 404 })
  }

  const raw = await readDecision(request)
  if (!raw) {
    return userFacingError('The request was malformed. Start again from ChatGPT.', 400)
  }

  const parsed = approveSchema.safeParse(raw)
  if (!parsed.success) {
    return userFacingError('The request was malformed. Start again from ChatGPT.', 400)
  }

  const pending = await getAuthRequest(parsed.data.request)
  if (!pending) {
    return userFacingError(
      'This authorization request has expired. Close this window and connect again from ChatGPT.',
      400
    )
  }

  if (parsed.data.decision === 'deny') {
    await deleteAuthRequest(parsed.data.request)
    console.log('[MCP_OAUTH_APPROVE]', JSON.stringify({ outcome: 'denied' }))
    return redirectTo(
      buildAuthorizationResponse(pending.redirectUri, {
        state: pending.state,
        error: 'access_denied',
        error_description: 'The user declined the request.',
      })
    )
  }

  if (!pending.verifiedEmail) {
    return userFacingError('Verify your email address first.', 400)
  }

  const role = await resolveContentRole(pending.verifiedEmail)
  if (!role) {
    await deleteAuthRequest(parsed.data.request)
    console.warn('[MCP_OAUTH_APPROVE] Role withdrawn between verification and approval.')
    return userFacingError('This account is no longer authorized for content editing.', 403)
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

  const target = buildAuthorizationResponse(pending.redirectUri, {
    state: pending.state,
    code,
  })

  console.log(
    '[MCP_OAUTH_APPROVE]',
    JSON.stringify({
      outcome: 'approved',
      scopes: pending.scopes,
      // The destination, so a flow that stalls after this point can be told
      // apart from one that never got here. No code or state is logged.
      redirectHost: target.host,
    })
  )

  return redirectTo(target)
}
