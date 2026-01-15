import { z } from 'zod';
import { normalizeIsraelE164, isValidIsraelE164 } from '@/lib/phone';
import { userExistsByPhone, userExistsByEmail } from '@/lib/user-check';
import { NextRequest } from 'next/server';

const requestSchema = z.object({
  otpType: z.enum(['sms', 'email']),
  otpValue: z.string().trim().min(1),
  checkUserExists: z.boolean().optional(),
  turnstileToken: z.string().optional(),
});

// 🔐 Verify Cloudflare Turnstile token
async function validateTurnstile(token: string, remoteip?: string) {
  const params = new URLSearchParams();
  params.append('secret', process.env.TURNSTILE_SECRET_KEY || '');
  params.append('response', token);
  if (remoteip) params.append('remoteip', remoteip);

  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await resp.json();
    return data;
  } catch (err) {
    console.error('[OTP SEND] Turnstile validation error:', err);
    return { success: false, 'error-codes': ['http-error'] };
  }
}

const INFORU_API_URL = 'https://capi.inforu.co.il/api/Otp/SendOtp';
const INFORU_USERNAME = process.env.INFORU_USERNAME;
const INFORU_TOKEN = process.env.INFORU_TOKEN;

const COOLDOWN_MS = 60 * 1000; // 60 seconds

// Simple in-memory cooldown store (keyed by otpValue)
const cooldownStore = new Map<string, number>();

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request. Please provide otpType (sms|email) and otpValue.' },
        { status: 400 }
      );
    }

    const { otpType, otpValue, checkUserExists, turnstileToken } = parsed.data;

    // Check if running on localhost (skip Turnstile validation in development)
    const host = request.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || process.env.NODE_ENV === 'development';

    // 🔐 VERIFY TURNSTILE TOKEN (skip on localhost)
    if (!isLocalhost) {
      if (!turnstileToken) {
        console.warn('[OTP SEND] No Turnstile token provided');
        return Response.json(
          { error: 'Security verification required. Please complete the verification.' },
          { status: 400 }
        );
      }

      // Extract client IP for Turnstile validation
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                 request.headers.get('x-real-ip') || 
                 'unknown';

      // 🔐 TURNSTILE VERIFICATION
      const validation = await validateTurnstile(turnstileToken, ip);

      if (!validation.success) {
        console.error('[OTP SEND] Invalid Turnstile token:', validation['error-codes']);
        return Response.json(
          { error: 'Invalid verification. Please try again.' },
          { status: 400 }
        );
      }
    } else {
      console.log('[OTP SEND] Skipping Turnstile validation on localhost');
    }

    // Validate environment variables
    if (!INFORU_USERNAME || !INFORU_TOKEN) {
      console.error('[OTP SEND] Missing Inforu credentials');
      return Response.json(
        { error: 'OTP service is currently unavailable.' },
        { status: 500 }
      );
    }

    // Validate phone format for SMS
    if (otpType === 'sms') {
      // Accept both E.164 and local format, but validate it's a valid Israeli number
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

    // Check cooldown
    const lastSent = cooldownStore.get(otpValue);
    if (lastSent && Date.now() - lastSent < COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
      return Response.json(
        { 
          error: 'COOLDOWN', 
          message: `Please wait ${remainingSeconds}s before requesting another code.` 
        },
        { status: 429 }
      );
    }

    // Optional user existence check (for sign-in flow)
    if (checkUserExists) {
      if (otpType === 'sms') {
        // Normalize phone to E.164 for database lookup
        const normalizedPhone = normalizeIsraelE164(otpValue);
        if (!normalizedPhone) {
          return Response.json(
            { error: 'Invalid phone number format.' },
            { status: 400 }
          );
        }

        const exists = await userExistsByPhone(normalizedPhone);
        if (!exists) {
          return Response.json(
            { error: 'USER_NOT_FOUND', message: 'This phone number is not registered.' },
            { status: 404 }
          );
        }
      } else if (otpType === 'email') {
        const normalizedEmail = otpValue.trim().toLowerCase();
        const exists = await userExistsByEmail(normalizedEmail);
        if (!exists) {
          return Response.json(
            { error: 'USER_NOT_FOUND', message: 'This email address is not registered.' },
            { status: 404 }
          );
        }
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
        OtpType: otpType,
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
      console.error('[OTP SEND] Inforu API timeout:', timeoutError);
      return Response.json(
        { error: 'OTP service is currently unavailable. Please try again.' },
        { status: 500 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[OTP SEND] Inforu API error:', response.status, errorText);
      return Response.json(
        { error: 'Failed to send code. Please try again.' },
        { status: 500 }
      );
    }

    const result = await response.json().catch(async () => {
      const text = await response.text();
      throw new Error(`Invalid JSON response from Inforu: ${text}`);
    });

    // Check Inforu response status
    if (result.StatusId !== 1) {
      const errorMsg = result.StatusDescription || result.DetailDescription || 'Failed to send code';
      console.error('[OTP SEND] Inforu returned error:', result);
      return Response.json(
        { error: errorMsg },
        { status: 400 }
      );
    }

    // Update cooldown
    cooldownStore.set(otpValue, Date.now());

    return Response.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error('[OTP SEND] Handler error:', err);
    return Response.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
