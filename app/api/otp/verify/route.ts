import { z } from 'zod';
import { adminAuth } from '@/lib/firebase-admin';
import { normalizeIsraelE164 } from '@/lib/phone';
import { userExistsByPhone, userExistsByEmail } from '@/lib/user-check';

const requestSchema = z.object({
  otpType: z.enum(['sms', 'email']),
  otpValue: z.string().trim().min(1),
  otpCode: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
  requireUserExists: z.boolean().optional(), // For sign-in flow: user MUST exist
  existingFirebaseUid: z.string().optional(), // For Google signup: link phone to existing Firebase user
});

const INFORU_API_URL = 'https://capi.inforu.co.il/api/Otp/Authenticate';
const INFORU_USERNAME = process.env.INFORU_USERNAME;
const INFORU_TOKEN = process.env.INFORU_TOKEN;

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request. Please provide otpType (sms|email), otpValue, and 6-digit otpCode.' },
        { status: 400 }
      );
    }

    const { otpType, otpValue, otpCode, requireUserExists, existingFirebaseUid } = parsed.data;

    // Validate environment variables
    if (!INFORU_USERNAME || !INFORU_TOKEN) {
      console.error('[OTP VERIFY] Missing Inforu credentials');
      return Response.json(
        { error: 'OTP service is currently unavailable.' },
        { status: 500 }
      );
    }

    // Validate phone format for SMS
    if (otpType === 'sms') {
      const normalized = normalizeIsraelE164(otpValue);
      if (!normalized && !otpValue.startsWith('0') && !otpValue.startsWith('+972')) {
        return Response.json(
          { error: 'Invalid phone number format.' },
          { status: 400 }
        );
      }
    }

    // Validate email format
    if (otpType === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(otpValue)) {
        return Response.json(
          { error: 'Invalid email address.' },
          { status: 400 }
        );
      }
    }

    // Prepare Inforu API request
    // Pass phone/email as-is (Inforu accepts both formats)
    const payload = {
      User: {
        UserName: INFORU_USERNAME,
        Token: INFORU_TOKEN,
      },
      Data: {
        OtpCode: otpCode,
        OtpValue: otpValue,
      },
    };

    // Call Inforu API
    const timeoutMs = 15000; // 15 seconds
    const fetchPromise = fetch(INFORU_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    let response: Response;
    try {
      response = await Promise.race([
        fetchPromise,
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Inforu API timeout after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]) as Response;
    } catch (timeoutError) {
      console.error('[OTP VERIFY] Inforu API timeout:', timeoutError);
      return Response.json(
        { error: 'OTP service is currently unavailable. Please try again.' },
        { status: 500 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[OTP VERIFY] Inforu API error:', response.status, errorText);
      return Response.json(
        { error: 'Invalid or expired code.' },
        { status: 401 }
      );
    }

    const result = await response.json().catch(async () => {
      const text = await response.text();
      throw new Error(`Invalid JSON response from Inforu: ${text}`);
    });

    // Check Inforu response status
    if (result.StatusId !== 1) {
      const errorMsg = result.StatusDescription || result.DetailDescription || 'Invalid or expired code';
      console.error('[OTP VERIFY] Inforu returned error:', result);
      
      // Check specifically for expired code (StatusId: -98)
      if (result.StatusId === -98 || errorMsg.toLowerCase().includes('expired')) {
        return Response.json(
          { error: 'CODE_EXPIRED', message: 'Code expired. Please request a new code.' },
          { status: 401 }
        );
      }
      
      // Map other invalid code errors
      if (errorMsg.toLowerCase().includes('invalid')) {
        return Response.json(
          { error: 'Invalid or expired code. Please request a new code.' },
          { status: 401 }
        );
      }
      
      return Response.json(
        { error: errorMsg },
        { status: 401 }
      );
    }

    // OTP is valid - now handle Firebase user creation/lookup
    let firebaseUser;
    let isNewUser = false;
    let normalizedIdentifier: string;

    if (otpType === 'sms') {
      // Normalize phone to E.164 for database operations
      const normalizedPhone = normalizeIsraelE164(otpValue);
      if (!normalizedPhone) {
        return Response.json(
          { error: 'Invalid phone number format.' },
          { status: 400 }
        );
      }
      normalizedIdentifier = normalizedPhone;

      // For sign-in flow: check if user exists (only if existingFirebaseUid not provided)
      if (requireUserExists && !existingFirebaseUid) {
        const exists = await userExistsByPhone(normalizedIdentifier);
        if (!exists) {
          return Response.json(
            { error: 'This phone number is not registered.' },
            { status: 404 }
          );
        }
      }

      // Try to find or create Firebase user
      try {
        const { prisma } = await import('@/lib/prisma');
        
        // For Google signup: if existingFirebaseUid is provided, use that user
        if (existingFirebaseUid) {
          try {
            firebaseUser = await adminAuth.getUser(existingFirebaseUid);
            // Update phone if not set or different
            if (firebaseUser.phoneNumber !== normalizedIdentifier) {
              try {
                await adminAuth.updateUser(existingFirebaseUid, {
                  phoneNumber: normalizedIdentifier,
                });
                firebaseUser = await adminAuth.getUser(existingFirebaseUid); // Re-fetch to get updated user object
              } catch (updateErr: any) {
                if (updateErr?.code === 'auth/phone-number-already-exists') {
                  return Response.json(
                    { error: 'Phone number is already in use.' },
                    { status: 409 }
                  );
                }
                throw updateErr;
              }
            }
          } catch (err: any) {
            if (err?.code === 'auth/user-not-found') {
              return Response.json(
                { error: 'User account not found.' },
                { status: 404 }
              );
            }
            throw err;
          }
        } else {
          // Existing logic for non-Google signup/sign-in
          // Check database first to get firebaseUid if user exists
          const dbUser = await prisma.user.findUnique({
            where: { phone: normalizedIdentifier },
            select: { firebaseUid: true }
          });

          if (dbUser?.firebaseUid) {
            // User exists in database - get Firebase user by UID
            try {
              firebaseUser = await adminAuth.getUser(dbUser.firebaseUid);
              // Update phone if not set or different
              if (firebaseUser.phoneNumber !== normalizedIdentifier) {
                try {
                  await adminAuth.updateUser(dbUser.firebaseUid, {
                    phoneNumber: normalizedIdentifier,
                  });
                  firebaseUser = await adminAuth.getUser(dbUser.firebaseUid);
                } catch (updateErr: any) {
                  if (updateErr?.code === 'auth/phone-number-already-exists') {
                    return Response.json(
                      { error: 'Phone number is already in use.' },
                      { status: 409 }
                    );
                  }
                  // If update fails, continue with existing user
                  console.warn('[OTP VERIFY] Failed to update phone number:', updateErr);
                }
              }
            } catch (err: any) {
              if (err?.code === 'auth/user-not-found') {
                // Firebase user doesn't exist but DB user does - create Firebase user
                // Don't set password - user will authenticate via custom tokens only
                firebaseUser = await adminAuth.createUser({
                  uid: dbUser.firebaseUid,
                  phoneNumber: normalizedIdentifier,
                });
              } else {
                throw err;
              }
            }
          } else {
            // User doesn't exist in database - create new Firebase user (for signup flow)
            // Don't set password - user will authenticate via custom tokens only
            firebaseUser = await adminAuth.createUser({
              phoneNumber: normalizedIdentifier,
            });
            isNewUser = true;
          }
        }
      } catch (err: any) {
        if (err?.code === 'auth/phone-number-already-exists') {
          // Phone already exists in Firebase
          console.error('[OTP VERIFY] Phone number already exists in Firebase:', err);
          return Response.json(
            { error: 'Phone number is already in use.' },
            { status: 409 }
          );
        }
        throw err;
      }
    } else {
      // Email OTP
      normalizedIdentifier = otpValue.trim().toLowerCase();

      // For sign-in flow: check if user exists
      if (requireUserExists) {
        const exists = await userExistsByEmail(normalizedIdentifier);
        if (!exists) {
          return Response.json(
            { error: 'This email address is not registered.' },
            { status: 404 }
          );
        }
      }

      // Try to find or create Firebase user by email
      try {
        firebaseUser = await adminAuth.getUserByEmail(normalizedIdentifier);
      } catch (err: any) {
        // User doesn't exist - we'll create them
        if (err?.code === 'auth/user-not-found') {
          // Don't set password - user will authenticate via custom tokens only
          firebaseUser = await adminAuth.createUser({
            email: normalizedIdentifier,
            emailVerified: true,
          });
          isNewUser = true;
        } else {
          throw err;
        }
      }
    }

    // Create custom token for the user
    const customToken = await adminAuth.createCustomToken(firebaseUser.uid);

    return Response.json({
      ok: true,
      customToken,
      uid: firebaseUser.uid,
      isNewUser,
    });
  } catch (err: any) {
    console.error('[OTP VERIFY] Handler error:', err);
    const message =
      typeof err?.message === 'string' ? err.message : 'Failed to verify code';
    return Response.json({ error: message }, { status: 500 });
  }
}
