import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  return NextResponse.json(
    { success: false, error: 'Newsletter sync is disabled. Neon is the source of truth.' },
    { status: 410 }
  )
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  return NextResponse.json(
    { success: false, error: 'Newsletter sync is disabled. Neon is the source of truth.' },
    { status: 410 }
  )
}