import { NextRequest, NextResponse } from 'next/server'
import { requireUserAuth } from '@/lib/server/auth'

export async function GET(request: NextRequest) {
  const auth = await requireUserAuth(request)
  if (auth instanceof NextResponse) return auth

  return NextResponse.json({ ok: true, isAdmin: auth.isAdmin })
}
