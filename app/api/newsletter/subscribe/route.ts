import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Neon-only: subscribe/upsert into Postgres
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // IMPORTANT: normalize to avoid duplicates like "A@b.com" vs "a@b.com"
    const normalizedEmail = String(email).trim().toLowerCase()

    // One atomic DB operation: create if missing, otherwise reactivate
    const record = await prisma.newsletterEmails.upsert({
      where: { email: normalizedEmail },     // works because email is @unique in Prisma
      update: { isActive: true },
      create: { email: normalizedEmail, isActive: true },
    })

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed to newsletter',
      id: record.id, // optional: now Neon row id (not Firebase)
    })
  } catch (error) {
    console.error('Newsletter subscription error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to subscribe to newsletter',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}