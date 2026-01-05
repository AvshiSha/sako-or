import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json().catch(() => ({}))

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = String(email).trim().toLowerCase()

    // Neon is source of truth: mark as inactive
    await prisma.newsletterEmails.updateMany({
      where: { email: normalizedEmail },
      data: { isActive: false },
    })

    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed from newsletter',
    })
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to unsubscribe from newsletter',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}