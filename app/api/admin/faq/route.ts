import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { createFaqSchema } from '@/lib/schemas/faq-schema';
import {
  createFaqDoc,
  getAllFaqsAdmin,
  plainTextQuestion,
  sanitizeAnswerField,
} from '@/lib/server/faq-mutations';
import { faqAnswerHadDemotedHeadings } from '@/lib/sanitize-html';
import { buildFaqSlug, ensureUniqueFaqSlug, isValidFaqSlug } from '@/lib/faq-slug';
import { nextOrderForAudience } from '@/lib/faq-order';
import { revalidateFaqSurfaces } from '@/lib/faq-revalidate';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/faq — every FAQ, any status.
 *
 * The admin list screen reads through the client SDK (the admin claim satisfies
 * the read rule), so this exists mainly for scripts and for verifying
 * authorization end to end.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const items = await getAllFaqsAdmin();
    return NextResponse.json({ items });
  } catch (error) {
    Sentry.captureException(error);
    console.error('[ADMIN_FAQ_LIST_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load FAQs' }, { status: 500 });
  }
}

/**
 * POST /api/admin/faq — create a question.
 *
 * Defaults to draft: creating and publishing are separate decisions, and a
 * mis-wired client should not be able to put copy on a public page by omitting
 * a field.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = createFaqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const input = parsed.data;

  try {
    const existing = await getAllFaqsAdmin();
    const takenSlugs = existing
      .map((item) => item.slug)
      .filter((slug): slug is string => Boolean(slug));

    // An explicit slug is honoured but must be unique — silently suffixing one
    // the admin typed would produce a URL they did not expect to share.
    let slug: string;
    if (input.slug) {
      if (!isValidFaqSlug(input.slug)) {
        return NextResponse.json({ error: 'Invalid slug', code: 'INVALID_SLUG' }, { status: 400 });
      }
      if (takenSlugs.includes(input.slug)) {
        return NextResponse.json(
          { error: 'That slug is already in use', code: 'SLUG_TAKEN' },
          { status: 409 }
        );
      }
      slug = input.slug;
    } else {
      slug = ensureUniqueFaqSlug(
        buildFaqSlug(input.question, existing.length + 1),
        takenSlugs
      );
    }

    const question = plainTextQuestion(input.question);
    const answer = sanitizeAnswerField(input.answerHtml, faqAnswerHadDemotedHeadings);

    // Sanitization can empty an answer that was nothing but disallowed markup.
    if (!answer.he.trim() && !answer.en.trim()) {
      return NextResponse.json(
        { error: 'The answer is empty after sanitization', code: 'EMPTY_ANSWER' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const id = await createFaqDoc({
      slug,
      audience: input.audience,
      topic: input.topic,
      question,
      answerHtml: { he: answer.he, en: answer.en },
      ...(input.shortAnswer ? { shortAnswer: input.shortAnswer } : {}),
      ...(input.relatedLinks ? { relatedLinks: input.relatedLinks } : {}),
      order: nextOrderForAudience(existing, input.audience),
      status: input.status,
      ...(input.featured !== undefined ? { featured: input.featured } : {}),
      ...(input.status === 'published' ? { publishedAt: now } : {}),
      createdAt: now,
      updatedAt: now,
      createdBy: auth.email ?? 'unknown',
      updatedBy: auth.email ?? 'unknown',
    });

    revalidateFaqSurfaces();

    return NextResponse.json({ id, slug, warnings: answer.warnings }, { status: 201 });
  } catch (error) {
    Sentry.captureException(error);
    console.error('[ADMIN_FAQ_CREATE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to create FAQ' }, { status: 500 });
  }
}
