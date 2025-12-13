import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Newsletter sync is disabled. Neon is the source of truth.' },
    { status: 410 }
  )
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Newsletter sync is disabled. Neon is the source of truth.' },
    { status: 410 }
  )
}