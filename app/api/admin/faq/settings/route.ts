import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { faqSettingsSchema } from '@/lib/schemas/faq-schema';
import { getFaqSettingsAdmin, upsertFaqSettings } from '@/lib/server/faq-mutations';
import { sanitizeCmsHtml } from '@/lib/sanitize-html';
import { cmsHtmlToPlainText } from '@/lib/cms-html-cleanup';
import { revalidateFaqSurfaces } from '@/lib/faq-revalidate';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const settings = await getFaqSettingsAdmin();
    return NextResponse.json({ settings });
  } catch (error) {
    Sentry.captureException(error);
    console.error('[ADMIN_FAQ_SETTINGS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load FAQ settings' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/faq/settings — the FAQ page's own copy and metadata.
 *
 * The doc ID is fixed, so this is a create-or-update in one call, matching
 * staticPageService.upsertStaticPage.
 *
 * CTA destinations are re-validated here by the zod schema even though the form
 * checks them too: the client check is for feedback, this one is the rule.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = faqSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const input = parsed.data;

  try {
    const existing = await getFaqSettingsAdmin();
    const now = new Date().toISOString();

    await upsertFaqSettings({
      // The h1 is rendered as text, not markup — strip anything pasted in.
      heading: {
        he: cmsHtmlToPlainText(input.heading.he).slice(0, 200),
        en: cmsHtmlToPlainText(input.heading.en).slice(0, 200),
      },
      // The intro is rich text and shares the storefront CMS renderer, so it
      // gets the standard CMS sanitizer rather than the FAQ answer one: it sits
      // directly under the h1, where an h2 is legitimate.
      intro: {
        he: sanitizeCmsHtml(input.intro.he),
        en: sanitizeCmsHtml(input.intro.en),
      },
      sectionTitles: {
        women: {
          he: cmsHtmlToPlainText(input.sectionTitles.women.he).slice(0, 120),
          en: cmsHtmlToPlainText(input.sectionTitles.women.en).slice(0, 120),
        },
        men: {
          he: cmsHtmlToPlainText(input.sectionTitles.men.he).slice(0, 120),
          en: cmsHtmlToPlainText(input.sectionTitles.men.en).slice(0, 120),
        },
        general: {
          he: cmsHtmlToPlainText(input.sectionTitles.general.he).slice(0, 120),
          en: cmsHtmlToPlainText(input.sectionTitles.general.en).slice(0, 120),
        },
      },
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      ...(input.ogTitle ? { ogTitle: input.ogTitle } : {}),
      ...(input.ogDescription ? { ogDescription: input.ogDescription } : {}),
      ...(input.ogImage !== undefined ? { ogImage: input.ogImage } : {}),
      robots: input.robots,
      primaryCta: input.primaryCta,
      ...(input.secondaryCta ? { secondaryCta: input.secondaryCta } : {}),
      ...(existing ? {} : { createdAt: now }),
      updatedAt: now,
      updatedBy: auth.email ?? 'unknown',
    });

    revalidateFaqSurfaces();

    return NextResponse.json({ saved: true });
  } catch (error) {
    Sentry.captureException(error);
    console.error('[ADMIN_FAQ_SETTINGS_SAVE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to save FAQ settings' }, { status: 500 });
  }
}
