import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { faqPreviewSchema } from '@/lib/schemas/faq-schema';
import { faqAnswerHadDemotedHeadings, sanitizeFaqAnswerHtml } from '@/lib/sanitize-html';
import { cmsHtmlToPlainText } from '@/lib/cms-html-cleanup';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/faq/preview
 *
 * Round-trips unsaved editor content through the real sanitizer so the preview
 * modal shows exactly what would be published — including anything the
 * sanitizer strips or demotes. This route exists because sanitize-html is
 * Node-only and cannot run in the browser, the same reason
 * /api/admin/preview-static-page exists.
 *
 * Writes nothing. Still admin-guarded: it is an authenticated surface that
 * echoes back attacker-supplied HTML, and there is no reason to expose it.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = faqPreviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const { question, answerHtml } = parsed.data;
    const warnings: string[] = [];

    if (faqAnswerHadDemotedHeadings(answerHtml)) {
      warnings.push(
        'A heading in the answer was converted to H3. The page already provides the H1, and each question is an H2.'
      );
    }

    const sanitized = sanitizeFaqAnswerHtml(answerHtml);
    if (answerHtml.trim() && !sanitized.trim()) {
      warnings.push('Nothing in this answer survived sanitization.');
    }

    return NextResponse.json({
      question: cmsHtmlToPlainText(question),
      answerHtml: sanitized,
      warnings,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error('[ADMIN_FAQ_PREVIEW_ERROR]', error);
    return NextResponse.json({ error: 'Failed to build preview' }, { status: 500 });
  }
}
