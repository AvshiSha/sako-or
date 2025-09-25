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

    // Subscribe to newsletter in Firebase
    const firebaseId = await newsletterService.subscribeToNewsletter(email)
    
    // Also create/update in Neon DB
    try {
      const existingEmail = await prisma.newsletterEmails.findFirst({
        where: { email: email }
      })

      if (existingEmail) {
        // Update existing email
        await prisma.newsletterEmails.update({
          where: { id: existingEmail.id },
          data: { isActive: true }
        })
      } else {
        // Create new email
        await prisma.newsletterEmails.create({
          data: {
            email: email,
            isActive: true,
            createdAt: new Date()
          }
        })
      }
      
      console.log(`Newsletter email "${email}" synced to both Firebase and Neon DB`)
    } catch (prismaError) {
      console.error('Failed to sync newsletter email to Neon DB:', prismaError)
      // Don't fail the request if Neon DB sync fails
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed to newsletter',
      id: firebaseId
    })
    
  } catch (error) {
    console.error('Newsletter subscription error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to subscribe to newsletter',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
