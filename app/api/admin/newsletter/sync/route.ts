import { NextRequest, NextResponse } from 'next/server'
import { newsletterService } from '@/lib/firebase'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting newsletter email synchronization from Firebase to Neon DB...')
    
    // Get all newsletter emails from Firebase
    const firebaseEmails = await newsletterService.getAllNewsletterEmails()
    console.log(`Found ${firebaseEmails.length} newsletter emails in Firebase`)
    
    let syncedCount = 0
    let createdCount = 0
    let updatedCount = 0
    let deletedCount = 0
    const errors: string[] = []
    
    // Get all existing newsletter emails in Neon DB
    const existingNeonEmails = await prisma.newsletterEmails.findMany()
    const firebaseEmailAddresses = new Set(
      firebaseEmails.map(email => email.email)
    )
    
    // Delete emails that exist in Neon DB but not in Firebase
    for (const neonEmail of existingNeonEmails) {
      if (!firebaseEmailAddresses.has(neonEmail.email)) {
        try {
          await prisma.newsletterEmails.delete({
            where: { id: neonEmail.id }
          })
          deletedCount++
          console.log(`Deleted newsletter email: ${neonEmail.email}`)
        } catch (error) {
          const errorMsg = `Failed to delete newsletter email "${neonEmail.email}": ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(errorMsg)
          errors.push(errorMsg)
        }
      }
    }
    
    for (const firebaseEmail of firebaseEmails) {
      try {
        // Check if email already exists in Neon DB
        const existingEmail = await prisma.newsletterEmails.findFirst({
          where: { email: firebaseEmail.email }
        })

        // Convert Firebase timestamp to JavaScript Date
        let createdAt = new Date()
        if (firebaseEmail.subscribedAt) {
          if (firebaseEmail.subscribedAt instanceof Date) {
            createdAt = firebaseEmail.subscribedAt
          } else if (typeof firebaseEmail.subscribedAt === 'object' && (firebaseEmail.subscribedAt as any).seconds) {
            // Firebase timestamp object
            createdAt = new Date((firebaseEmail.subscribedAt as any).seconds * 1000)
          }
        }

        const emailData = {
          email: firebaseEmail.email,
          isActive: firebaseEmail.isActive !== undefined ? firebaseEmail.isActive : true,
          createdAt: createdAt,
        }

        if (existingEmail) {
          // Update existing email
          await prisma.newsletterEmails.update({
            where: { id: existingEmail.id },
            data: {
              isActive: emailData.isActive,
            }
          })
          updatedCount++
          console.log(`Updated newsletter email: ${firebaseEmail.email}`)
        } else {
          // Create new email
          await prisma.newsletterEmails.create({
            data: emailData
          })
          createdCount++
          console.log(`Created newsletter email: ${firebaseEmail.email}`)
        }
        
        syncedCount++
      } catch (error) {
        const errorMsg = `Failed to sync newsletter email "${firebaseEmail.email}": ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }
    
    const result = {
      success: true,
      message: `Successfully synchronized ${syncedCount} newsletter emails`,
      stats: {
        total: firebaseEmails.length,
        synced: syncedCount,
        created: createdCount,
        updated: updatedCount,
        deleted: deletedCount,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    }
    
    console.log('Newsletter email synchronization completed:', result)
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Newsletter email synchronization error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to synchronize newsletter emails',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get newsletter emails from both Firebase and Neon DB for comparison
    const firebaseEmails = await newsletterService.getAllNewsletterEmails()
    const neonEmails = await prisma.newsletterEmails.findMany({
      orderBy: { email: 'asc' }
    })
    
    // Compare emails
    const firebaseEmailAddresses = firebaseEmails.map(email => email.email)
    const neonEmailAddresses = neonEmails.map(email => email.email)
    
    const missingInNeon = firebaseEmailAddresses.filter(email => !neonEmailAddresses.includes(email))
    const extraInNeon = neonEmailAddresses.filter(email => !firebaseEmailAddresses.includes(email))
    
    return NextResponse.json({
      success: true,
      comparison: {
        firebase: {
          count: firebaseEmails.length,
          emails: firebaseEmailAddresses
        },
        neon: {
          count: neonEmails.length,
          emails: neonEmailAddresses
        },
        differences: {
          missingInNeon,
          extraInNeon,
          needsSync: missingInNeon.length > 0 || extraInNeon.length > 0
        }
      }
    })
    
  } catch (error) {
    console.error('Error comparing newsletter emails:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to compare newsletter emails',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
