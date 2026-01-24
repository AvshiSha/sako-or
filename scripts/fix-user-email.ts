import * as admin from 'firebase-admin'
import { prisma } from '@/lib/prisma'

// Initialize Firebase Admin directly (bypass server-only import)
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    })
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    })
  }
}

const adminAuth = admin.auth()

async function fixUserEmail(userIdentifier: string, newEmail: string) {
  try {
    // 1. Find the user by phone/email/uid
    let user
    
    if (userIdentifier.includes('@')) {
      user = await adminAuth.getUserByEmail(userIdentifier)
    } else if (userIdentifier.startsWith('+972')) {
      user = await adminAuth.getUserByPhoneNumber(userIdentifier)
    } else {
      user = await adminAuth.getUser(userIdentifier)
    }

    console.log('📋 User Found:')
    console.log(`   UID: ${user.uid}`)
    console.log(`   Phone: ${user.phoneNumber}`)
    console.log(`   Old Email: ${user.email || '(none)'}`)
    console.log(`   New Email: ${newEmail}`)
    console.log('')

    // 2. Check if new email is already taken
    try {
      const existing = await adminAuth.getUserByEmail(newEmail)
      if (existing.uid !== user.uid) {
        console.error('❌ Error: Email already in use by another user!')
        return
      }
    } catch (err: any) {
      // Email not found - good!
    }

    // 3. Update Firebase Auth
    await adminAuth.updateUser(user.uid, {
      email: newEmail,
      emailVerified: false
    })
    console.log('✅ Firebase Auth updated')

    // 4. Update Database
    await prisma.user.update({
      where: { firebaseUid: user.uid },
      data: { email: newEmail }
    })
    console.log('✅ Database updated')
    console.log('')
    console.log('✅ SUCCESS! Email has been corrected.')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Command line arguments
const identifier = process.argv[2]
const newEmail = process.argv[3]

if (!identifier || !newEmail) {
  console.log('❌ Missing arguments!')
  console.log('')
  console.log('Usage:')
  console.log('  npx tsx scripts/fix-user-email.ts <identifier> <newEmail>')
  console.log('')
  console.log('Examples:')
  console.log('  npx tsx scripts/fix-user-email.ts "+972525927979" "correct@gmail.com"')
  console.log('  npx tsx scripts/fix-user-email.ts "wrong@email.com" "correct@gmail.com"')
  console.log('  npx tsx scripts/fix-user-email.ts "AVbmQuLQDmR4QUHfns" "correct@gmail.com"')
  process.exit(1)
}

fixUserEmail(identifier, newEmail)
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
