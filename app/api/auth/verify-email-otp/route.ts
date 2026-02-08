import { z } from 'zod';
import { adminAuth } from '@/lib/firebase-admin';
import { getOtpStore, safeLowerEmail } from '@/lib/otp-store';

const requestSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request. Please provide email and 6-digit code.' },
        { status: 400 }
      );
    }

    const { email, code } = parsed.data;
    const normalizedEmail = safeLowerEmail(email);

    const otpStore = getOtpStore();

    // Get OTP entry
    const entry = otpStore.get(normalizedEmail);

    if (!entry) {
      return Response.json(
        { error: 'Invalid or expired code. Please request a new code.' },
        { status: 400 }
      );
    }

    // Check expiration (5 minutes)
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(normalizedEmail);
      return Response.json(
        { error: 'Code expired. Please request a new code.' },
        { status: 400 }
      );
    }

    // Check attempts
    if (entry.attempts >= MAX_ATTEMPTS) {
      otpStore.delete(normalizedEmail);
      return Response.json(
        { error: 'Too many attempts. Please request a new code.' },
        { status: 400 }
      );
    }

    // Verify code
    if (entry.code !== code) {
      entry.attempts += 1;
      otpStore.set(normalizedEmail, entry);
      return Response.json(
        { error: 'Invalid code. Please try again.' },
        { status: 400 }
      );
    }

    // Code is valid - delete it
    otpStore.delete(normalizedEmail);

    // Check if user exists in Firebase
    let firebaseUser;
    let isNewUser = false;
    try {
      const userRecord = await adminAuth.getUserByEmail(normalizedEmail);
      firebaseUser = userRecord;
    } catch (err: any) {
      // User doesn't exist - we'll create them
      if (err?.code === 'auth/user-not-found') {
        // Create new user - use a secure random password
        // The password won't be used since we're using custom token auth
        const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12) + 'A1!';
        const userRecord = await adminAuth.createUser({
          email: normalizedEmail,
          password: tempPassword,
          emailVerified: true, // Mark email as verified since they verified OTP
        });
        firebaseUser = userRecord;
        isNewUser = true;
      } else {
        throw err;
      }
    }

    // Create custom token for the user
    // Client will use signInWithCustomToken to sign in
    const customToken = await adminAuth.createCustomToken(firebaseUser.uid);

    return Response.json({
      ok: true,
      customToken,
      uid: firebaseUser.uid,
      isNewUser,
    });
  } catch (err: any) {
    console.error('[VERIFY EMAIL OTP] Error:', err);
    const message =
      typeof err?.message === 'string' ? err.message : 'Failed to verify code';
    return Response.json({ error: message }, { status: 500 });
  }
}

