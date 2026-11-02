import { NextResponse } from 'next/server'

import { consumeRefreshToken, getAccessToken, revokeFamily } from '@/lib/mcp/oauth/store'
import { isMcpEnabled } from '@/lib/server/content-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * RFC 7009 token revocation.
 *
 * Implemented because the authorization server metadata advertises it, and an
 * advertised endpoint that 404s is worse than one that was never claimed.
 *
 * Revokes the whole token family rather than the single presented token. The
 * caller's intent in revoking is to end the grant, and leaving its sibling
 * refresh token alive would mean "revoked" access comes straight back on the
 * next refresh.
 *
 * Always answers 200, per RFC 7009 2.2: an unknown or already-revoked token is
 * not an error, and distinguishing the cases would turn this unauthenticated
 * endpoint into an oracle for whether a token string is live.
 */
export async function POST(request: Request) {
  if (!isMcpEnabled()) {
    return new NextResponse(null, { status: 404 })
  }

  const raw = await request.text()
  const params = new URLSearchParams(raw)
  const token = params.get('token') ?? ''

  if (token) {
    const access = await getAccessToken(token)
    if (access) {
      await revokeFamily(access.familyId)
    } else {
      // Not an access token: try it as a refresh token. consumeRefreshToken
      // reports a replay for an already-used one, which revokes the family as
      // a side effect -- the right outcome here either way.
      const result = await consumeRefreshToken(token)
      if (result.ok) await revokeFamily(result.record.familyId)
    }
  }

  return new NextResponse(null, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
