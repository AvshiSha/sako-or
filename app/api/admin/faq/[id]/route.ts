import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { updateFaqSchema } from '@/lib/schemas/faq-schema';
import {
  deleteFaqDoc,
  getAllFaqsAdmin,
  getFaqAdmin,
  plainTextQuestion,
  sanitizeAnswerField,
  updateFaqDoc,
  writeFaqOrders,
} from '@/lib/server/faq-mutations';
import { faqAnswerHadDemotedHeadings } from '@/lib/sanitize-html';
import { isValidFaqSlug } from '@/lib/faq-slug';
import { nextOrderForAudience, reorderAfterRemoval } from '@/lib/faq-order';
import { revalidateFaqSurfaces } from '@/lib/faq-revalidate';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const item = await getFaqAdmin(id);
    if (!item) return NextResponse.json({ error: 'FAQ not found' }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    Sentry.captureException(error);
    console.error('[ADMIN_FAQ_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load FAQ' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/faq/:id
 *
 * `order` is not accepted here — see the note on updateFaqSchema. Ordering only
 * moves through /api/admin/faq/reorder, which validates group membership.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateFaqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const input = parsed.data;

  try {
    const all = await getAllFaqsAdmin();
    const existing = all.find((item) => item.id === id);
    if (!existing) return NextResponse.json({ error: 'FAQ not found' }, { status: 404 });

    const update: Record<string, unknown> = {};
    const warnings: string[] = [];

    if (input.slug !== undefined && input.slug !== existing.slug) {
      if (!isValidFaqSlug(input.slug)) {
        return NextResponse.json({ error: 'Invalid slug', code: 'INVALID_SLUG' }, { status: 400 });
      }
      if (all.some((item) => item.id !== id && item.slug === input.slug)) {
        return NextResponse.json(
          { error: 'That slug is already in use', code: 'SLUG_TAKEN' },
          { status: 409 }
        );
      }
      // Renaming a published question breaks every inbound #faq-question-…
      // link. Allowed, because a genuine typo has to be fixable, but surfaced.
      if (existing.status === 'published') {
        warnings.push(
          `The slug changed from "${existing.slug}" to "${input.slug}". Existing links to this question will no longer open it.`
        );
      }
      update.slug = input.slug;
    }

    if (input.question !== undefined) update.question = plainTextQuestion(input.question);
    if (input.topic !== undefined) update.topic = input.topic;
    if (input.shortAnswer !== undefined) update.shortAnswer = input.shortAnswer;
    if (input.relatedLinks !== undefined) update.relatedLinks = input.relatedLinks;
    if (input.featured !== undefined) update.featured = input.featured;

    if (input.answerHtml !== undefined) {
      const answer = sanitizeAnswerField(input.answerHtml, faqAnswerHadDemotedHeadings);
      if (!answer.he.trim() && !answer.en.trim()) {
        return NextResponse.json(
          { error: 'The answer is empty after sanitization', code: 'EMPTY_ANSWER' },
          { status: 400 }
        );
      }
      update.answerHtml = { he: answer.he, en: answer.en };
      warnings.push(...answer.warnings);
    }

    if (input.status !== undefined && input.status !== existing.status) {
      update.status = input.status;
      // publishedAt records the FIRST publication, so an unhide does not
      // reset it and make the question look newer than it is.
      if (input.status === 'published' && !existing.publishedAt) {
        update.publishedAt = new Date().toISOString();
      }
    }

    // An audience change moves the question between two independently ordered
    // groups: the old one has to close its gap, and the question needs a
    // position at the end of the new one.
    let orderUpdates: Array<{ id: string; order: number }> = [];
    if (input.audience !== undefined && input.audience !== existing.audience) {
      update.audience = input.audience;
      update.order = nextOrderForAudience(
        all.filter((item) => item.id !== id),
        input.audience
      );
      orderUpdates = reorderAfterRemoval(all, existing.audience, id);
    }

    update.updatedAt = new Date().toISOString();
    update.updatedBy = auth.email ?? 'unknown';

    await updateFaqDoc(id, update);
    if (orderUpdates.length > 0) await writeFaqOrders(orderUpdates);

    revalidateFaqSurfaces();

    return NextResponse.json({ id, warnings });
  } catch (error) {
    Sentry.captureException(error);
    console.error('[ADMIN_FAQ_UPDATE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to update FAQ' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/faq/:id — permanent.
 *
 * The remaining questions in that audience are renumbered so the sequence stays
 * dense; a gap would otherwise decide where the next new question lands.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const all = await getAllFaqsAdmin();
    const existing = all.find((item) => item.id === id);
    if (!existing) return NextResponse.json({ error: 'FAQ not found' }, { status: 404 });

    await deleteFaqDoc(id);

    const orderUpdates = reorderAfterRemoval(all, existing.audience, id);
    if (orderUpdates.length > 0) await writeFaqOrders(orderUpdates);

    revalidateFaqSurfaces();

    return NextResponse.json({ deletedId: id, slug: existing.slug, reordered: orderUpdates.length });
  } catch (error) {
    Sentry.captureException(error);
    console.error('[ADMIN_FAQ_DELETE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to delete FAQ' }, { status: 500 });
  }
}
