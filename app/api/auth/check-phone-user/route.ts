import { z } from 'zod';
import { userExistsByPhone } from '@/lib/user-check';

const requestSchema = z.object({
  phone: z.string().trim().min(1),
});

/**
 * POST /api/auth/check-phone-user
 * 
 * Checks if a user exists by phone number before sending SMS verification.
 * This prevents sending verification codes to unregistered phone numbers.
 */
export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid phone number' },
        { status: 400 }
      );
    }

    const { phone } = parsed.data;

    // Check if user exists
    const userExists = await userExistsByPhone(phone);
    
    if (!userExists) {
      return Response.json(
        { error: 'USER_NOT_FOUND', message: 'This phone number is not registered' },
        { status: 404 }
      );
    }

    return Response.json({ ok: true, exists: true }, { status: 200 });
  } catch (err) {
    console.error('[CHECK PHONE USER] Handler error:', err);
    return Response.json(
      { error: 'INTERNAL_ERROR', message: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

