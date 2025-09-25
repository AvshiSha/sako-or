import { NextRequest, NextResponse } from 'next/server'
import { newsletterService } from '@/lib/firebase'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // Unsubscribe from newsletter in Firebase
    await newsletterService.unsubscribeFromNewsletter(email)
    
    // Also update in Neon DB
    try {
      await prisma.newsletterEmails.updateMany({
        where: { email: email },
        data: { isActive: false }
      })
      
      console.log(`Newsletter email "${email}" unsubscribed from both Firebase and Neon DB`)
    } catch (prismaError) {
      console.error('Failed to sync newsletter unsubscribe to Neon DB:', prismaError)
      // Don't fail the request if Neon DB sync fails
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed from newsletter'
    })
    
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to unsubscribe from newsletter',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
