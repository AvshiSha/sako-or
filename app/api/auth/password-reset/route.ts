import { z } from 'zod';
import { adminAuth } from '@/lib/firebase-admin';
import { sendPasswordResetEmail } from '@/lib/email';

const requestSchema = z.object({
  email: z.string().trim().email(),
  continueUrl: z.string().trim().url(),
  lng: z.enum(['en', 'he']).optional(),
});

function safeLowerEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildDirectResetLink(params: {
  continueUrl: string;
  generatedLink: string;
}) {
  const { continueUrl, generatedLink } = params;

  try {
    const actionUrl = new URL(generatedLink);
    const oobCode = actionUrl.searchParams.get('oobCode');
    if (!oobCode) return generatedLink;

    const url = new URL(continueUrl);
    url.searchParams.set('mode', 'resetPassword');
    url.searchParams.set('oobCode', oobCode);
    return url.toString();
  } catch {
    return generatedLink;
  }
}

export async function POST(request: Request) {
  // Important: always return success to avoid account enumeration.
  try {
    const json = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      // Still do not reveal anything; treat as success but don't send.
      return Response.json({ ok: true }, { status: 200 });
    }

    const { email, continueUrl, lng } = parsed.data;
    const to = safeLowerEmail(email);
    const isHebrew = (lng ?? (continueUrl.includes('/he/') ? 'he' : 'en')) === 'he';

    try {
      const generatedLink = await adminAuth.generatePasswordResetLink(to, {
        url: continueUrl,
        handleCodeInApp: true,
      });

      const resetPasswordLink = buildDirectResetLink({ continueUrl, generatedLink });

      await sendPasswordResetEmail({
        to,
        resetPasswordLink,
        isHebrew,
        brandName: 'Sako Or',
      });
    } catch (err) {
      // Swallow errors to keep response generic; log server-side.
      console.error('[PASSWORD RESET] Failed to generate/send reset email:', err);
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('[PASSWORD RESET] Handler error:', err);
    return Response.json({ ok: true }, { status: 200 });
  }
}


