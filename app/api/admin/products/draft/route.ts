import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { upsertProductDraft } from '@/lib/server/product-drafts'
import { signPreviewToken } from '@/lib/server/preview-token'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  let body: { draftId?: string; sourceProductId?: string; payload?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.payload || typeof body.payload !== 'object') {
    return NextResponse.json({ error: 'Missing product payload' }, { status: 400 })
  }

  const draftId = await upsertProductDraft({
    draftId: body.draftId ?? null,
    sourceProductId: body.sourceProductId ?? null,
    payload: body.payload,
    createdBy: auth.firebaseUid,
  })

  const { token, expiresAt } = signPreviewToken(draftId)

  return NextResponse.json(
    { draftId, token, expiresAt },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
