import * as admin from 'firebase-admin';

function ensureFirebaseAdminInitialized() {
  if (admin.apps.length) return;

  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  // Preferred: service account via env vars (works well on Vercel)
  if (clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
    return;
  }

  // Fallback: Application Default Credentials (local / GCP environments)
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  } catch {
    // Last resort: initialize without explicit credentials (may not support auth verify)
    admin.initializeApp();
  }
}

ensureFirebaseAdminInitialized();

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminStorage = admin.storage();

