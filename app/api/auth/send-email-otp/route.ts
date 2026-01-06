import { z } from 'zod';
import { sendEmailOtp } from '@/lib/email';
import { getOtpStore, generateOtpCode, safeLowerEmail } from '@/lib/otp-store';

const requestSchema = z.object({
  email: z.string().trim().email(),
  lng: z.enum(['en', 'he']).optional(),
});

const COOLDOWN_MS = 60 * 1000; // 60 seconds
const EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  // Always return success to avoid account enumeration
  try {
    const json = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      // Still return success but don't send
      return Response.json({ ok: true }, { status: 200 });
    }

    const { email, lng } = parsed.data;
    const normalizedEmail = safeLowerEmail(email);
    const isHebrew = lng === 'he';

    const otpStore = getOtpStore();

    // Check cooldown
    const existingEntry = otpStore.get(normalizedEmail);
    if (existingEntry) {
      const timeSinceLastSent = Date.now() - existingEntry.lastSentAt;
      if (timeSinceLastSent < COOLDOWN_MS) {
        // Still return success, but don't send
        return Response.json({ ok: true }, { status: 200 });
      }

      // Check if too many attempts
      if (existingEntry.attempts >= MAX_ATTEMPTS) {
        // Still return success, but don't send
        return Response.json({ ok: true }, { status: 200 });
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
    } catch (err) {
      // Swallow errors to keep response generic; log server-side
      console.error('[EMAIL OTP] Failed to send OTP email:', err);
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('[EMAIL OTP] Handler error:', err);
    return Response.json({ ok: true }, { status: 200 });
  }
}

