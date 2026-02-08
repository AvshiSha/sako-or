import { z } from 'zod';
import { sendEmailOtp } from '@/lib/email';
import { getOtpStore, generateOtpCode, safeLowerEmail } from '@/lib/otp-store';
import { userExistsByEmail } from '@/lib/user-check';

const requestSchema = z.object({
  email: z.string().trim().email(),
  lng: z.enum(['en', 'he']).optional(),
});

const COOLDOWN_MS = 60 * 1000; // 60 seconds
const EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const { email, lng } = parsed.data;
    const normalizedEmail = safeLowerEmail(email);
    const isHebrew = lng === 'he';

    // Check if user exists before sending OTP
    const userExists = await userExistsByEmail(normalizedEmail);
    if (!userExists) {
      return Response.json(
        { error: 'USER_NOT_FOUND', message: 'This email address is not registered' },
        { status: 404 }
      );
    }

    const otpStore = getOtpStore();

    // Check cooldown
    const existingEntry = otpStore.get(normalizedEmail);
    if (existingEntry) {
      const timeSinceLastSent = Date.now() - existingEntry.lastSentAt;
      if (timeSinceLastSent < COOLDOWN_MS) {
        return Response.json(
          { error: 'COOLDOWN', message: `Please wait ${Math.ceil((COOLDOWN_MS - timeSinceLastSent) / 1000)}s before requesting another code` },
          { status: 429 }
        );
      }

      // Check if too many attempts
      if (existingEntry.attempts >= MAX_ATTEMPTS) {
        return Response.json(
          { error: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts. Please try again later.' },
          { status: 429 }
        );
      }
    }

    try {
      // Generate new OTP code
      const otpCode = generateOtpCode();
      const expiresAt = Date.now() + EXPIRY_MS;

      // Store OTP
      otpStore.set(normalizedEmail, {
        code: otpCode,
        email: normalizedEmail,
        expiresAt,
        attempts: existingEntry?.attempts || 0,
        lastSentAt: Date.now(),
      });

      // Send email
      await sendEmailOtp({
        to: normalizedEmail,
        otpCode,
        isHebrew,
        brandName: 'Sako Or',
      });

      return Response.json({ ok: true }, { status: 200 });
    } catch (err) {
      console.error('[EMAIL OTP] Failed to send OTP email:', err);
      return Response.json(
        { error: 'SEND_FAILED', message: 'Failed to send verification code. Please try again.' },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('[EMAIL OTP] Handler error:', err);
    return Response.json(
      { error: 'INTERNAL_ERROR', message: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

